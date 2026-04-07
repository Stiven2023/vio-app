import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  employees,
  pettyCashFunds,
  pettyCashTransactions,
} from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import {
  isAccountingConfigurationError,
  postPettyCashTransactionEntry,
} from "@/src/utils/accounting-entries";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { z } from "zod";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "contabilidad:caja-menor:get",
    limit: 150,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CAJA_MENOR");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const fundId = String(searchParams.get("fundId") ?? "").trim();
    const transactionType = String(searchParams.get("type") ?? "")
      .trim()
      .toUpperCase();
    const dateFrom = String(searchParams.get("dateFrom") ?? "").trim();
    const dateTo = String(searchParams.get("dateTo") ?? "").trim();

    const fundsResult = await db
      .select({
        id: pettyCashFunds.id,
        name: pettyCashFunds.name,
        currentBalance: pettyCashFunds.currentBalance,
        currency: pettyCashFunds.currency,
        status: pettyCashFunds.status,
      })
      .from(pettyCashFunds)
      .where(eq(pettyCashFunds.status, "ACTIVE"))
      .orderBy(pettyCashFunds.name);

    const filters: Parameters<typeof and> = [];

    if (fundId) filters.push(eq(pettyCashTransactions.fundId, fundId));
    if (
      transactionType &&
      ["EXPENSE", "REPLENISHMENT", "OPENING", "ADJUSTMENT"].includes(
        transactionType,
      )
    ) {
      filters.push(
        eq(
          pettyCashTransactions.transactionType,
          transactionType as
            | "EXPENSE"
            | "REPLENISHMENT"
            | "OPENING"
            | "ADJUSTMENT",
        ),
      );
    }
    if (dateFrom)
      filters.push(gte(pettyCashTransactions.transactionDate, dateFrom));
    if (dateTo)
      filters.push(lte(pettyCashTransactions.transactionDate, dateTo));

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    const [totalResult, items] = await Promise.all([
      db
        .select({ count: sql<string>`count(*)` })
        .from(pettyCashTransactions)
        .where(whereClause),
      db
        .select({
          id: pettyCashTransactions.id,
          transactionCode: pettyCashTransactions.transactionCode,
          fundId: pettyCashTransactions.fundId,
          fundName: pettyCashFunds.name,
          transactionDate: pettyCashTransactions.transactionDate,
          transactionType: pettyCashTransactions.transactionType,
          category: pettyCashTransactions.category,
          description: pettyCashTransactions.description,
          amount: pettyCashTransactions.amount,
          balanceBefore: pettyCashTransactions.balanceBefore,
          balanceAfter: pettyCashTransactions.balanceAfter,
          referenceCode: pettyCashTransactions.referenceCode,
          attachmentUrl: pettyCashTransactions.attachmentUrl,
          notes: pettyCashTransactions.notes,
          currency: pettyCashFunds.currency,
          createdAt: pettyCashTransactions.createdAt,
          createdByName: employees.name,
        })
        .from(pettyCashTransactions)
        .leftJoin(
          pettyCashFunds,
          eq(pettyCashTransactions.fundId, pettyCashFunds.id),
        )
        .leftJoin(employees, eq(pettyCashTransactions.createdBy, employees.id))
        .where(whereClause)
        .orderBy(desc(pettyCashTransactions.createdAt))
        .limit(pageSize)
        .offset(offset),
    ]);

    const total = parseInt(totalResult[0]?.count ?? "0", 10);

    const summaryResult = await db
      .select({
        transactionType: pettyCashTransactions.transactionType,
        total: sql<string>`coalesce(sum(${pettyCashTransactions.amount}), 0)`,
      })
      .from(pettyCashTransactions)
      .where(whereClause)
      .groupBy(pettyCashTransactions.transactionType);

    const summaryMap: Record<string, number> = {};

    for (const row of summaryResult) {
      summaryMap[row.transactionType] = parseFloat(row.total ?? "0");
    }

    const summary = {
      totalExpenses: String(summaryMap["EXPENSE"] ?? 0),
      totalReplenishments: String(summaryMap["REPLENISHMENT"] ?? 0),
      totalAdjustments: String(summaryMap["ADJUSTMENT"] ?? 0),
    };

    return Response.json({
      items,
      funds: fundsResult,
      summary,
      page,
      pageSize,
      total,
      hasNextPage: offset + pageSize < total,
    });
  } catch (error) {
    const dbError = dbErrorResponse(error);

    if (dbError) return dbError;

    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "contabilidad:caja-menor:post",
    limit: 50,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_CAJA_MENOR");

  if (forbidden) return forbidden;

  const pettyCashPostSchema = z.object({
    fundId: z.string().uuid("fundId debe ser un UUID válido."),
    transactionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD."),
    transactionType: z.enum(["EXPENSE", "REPLENISHMENT", "OPENING", "ADJUSTMENT"], {
      error: "Tipo de transacción inválido. Use EXPENSE, REPLENISHMENT, OPENING o ADJUSTMENT.",
    }),
    category: z.string().max(100).optional().nullable(),
    description: z.string().min(1, "La descripción es obligatoria."),
    amount: z
      .number({ error: "El monto debe ser un número." })
      .positive("El monto debe ser mayor a cero."),
    referenceCode: z.string().max(120).optional().nullable(),
    notes: z.string().optional().nullable(),
  });

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "El cuerpo de la solicitud no es JSON válido.");
  }

  const parsed = pettyCashPostSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Los datos de la transacción son inválidos.");
  }

  const {
    fundId,
    transactionDate,
    transactionType,
    category,
    description,
    amount,
    referenceCode,
    notes,
  } = parsed.data;

  const employeeId = getEmployeeIdFromRequest(request);

  try {
    const [fund] = await db
      .select()
      .from(pettyCashFunds)
      .where(
        and(eq(pettyCashFunds.id, fundId), eq(pettyCashFunds.status, "ACTIVE")),
      )
      .limit(1);

    if (!fund) {
      return jsonError(404, "NOT_FOUND", "Caja menor no encontrada o inactiva.", {
        fundId: ["El fondo de caja menor no existe o está inactivo."],
      });
    }

    const currentBalance = parseFloat(fund.currentBalance ?? "0");

    if (transactionType === "EXPENSE" && amount > currentBalance) {
      return jsonError(409, "INSUFFICIENT_PETTY_CASH_BALANCE", "Saldo insuficiente en la caja menor.", {
        amount: [`El saldo disponible es ${currentBalance}; la transacción requiere ${amount}.`],
      });
    }

    const newBalance =
      transactionType === "EXPENSE"
        ? currentBalance - amount
        : currentBalance + amount;

    const lastTx = await db
      .select({ transactionCode: pettyCashTransactions.transactionCode })
      .from(pettyCashTransactions)
      .orderBy(desc(pettyCashTransactions.createdAt))
      .limit(1);

    let nextNum = 1;

    if (lastTx[0]?.transactionCode) {
      const match = lastTx[0].transactionCode.match(/CM-(\d+)/);

      if (match) nextNum = parseInt(match[1], 10) + 1;
    }

    const transactionCode = `CM-${String(nextNum).padStart(6, "0")}-${Date.now().toString(36).toUpperCase()}`;

    const newTx = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .insert(pettyCashTransactions)
        .values({
          transactionCode,
          fundId,
          transactionDate,
          transactionType,
          category: category ?? null,
          description,
          amount: String(amount),
          balanceBefore: String(currentBalance),
          balanceAfter: String(newBalance),
          referenceCode: referenceCode ?? null,
          notes: notes ?? null,
          createdBy: employeeId,
        })
        .returning();

      await tx
        .update(pettyCashFunds)
        .set({ currentBalance: String(newBalance), updatedAt: new Date() })
        .where(eq(pettyCashFunds.id, fundId));

      // Solo se generan asientos para EXPENSE, REPLENISHMENT y ADJUSTMENT
      if (transactionType !== "OPENING") {
        await postPettyCashTransactionEntry(
          tx,
          {
            transactionId: transaction.id,
            transactionCode,
            fundId,
            transactionDate,
            transactionType,
            amount,
            description,
          },
          employeeId,
        );
      }

      return transaction;
    });

    return Response.json(newTx, { status: 201 });
  } catch (error) {
    if (isAccountingConfigurationError(error)) {
      return jsonError(
        409,
        "ACCOUNTING_CONFIGURATION_MISSING",
        "Falta configuración contable para registrar la transacción de caja menor.",
        { accounting: ["Configura las cuentas contables antes de registrar movimientos de caja menor."] },
      );
    }

    const dbError = dbErrorResponse(error);

    if (dbError) return dbError;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo registrar la transacción de caja menor.");
  }
}
