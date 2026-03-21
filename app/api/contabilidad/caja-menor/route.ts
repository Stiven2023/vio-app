import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  employees,
  pettyCashFunds,
  pettyCashTransactions,
} from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

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
    return dbErrorResponse(error);
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

  try {
    const body = await request.json();
    const {
      fundId,
      transactionDate,
      transactionType,
      category,
      description,
      amount,
      referenceCode,
      notes,
    } = body;

    if (
      !fundId ||
      !transactionDate ||
      !transactionType ||
      !description ||
      !amount
    ) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const validTypes = ["EXPENSE", "REPLENISHMENT", "OPENING", "ADJUSTMENT"];

    if (!validTypes.includes(transactionType)) {
      return Response.json(
        { error: "Invalid transaction type" },
        { status: 400 },
      );
    }

    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      return Response.json(
        { error: "Amount must be positive" },
        { status: 400 },
      );
    }

    const [fund] = await db
      .select()
      .from(pettyCashFunds)
      .where(
        and(eq(pettyCashFunds.id, fundId), eq(pettyCashFunds.status, "ACTIVE")),
      )
      .limit(1);

    if (!fund) {
      return Response.json(
        { error: "Fund not found or inactive" },
        { status: 404 },
      );
    }

    const currentBalance = parseFloat(fund.currentBalance ?? "0");

    if (transactionType === "EXPENSE" && numAmount > currentBalance) {
      return Response.json(
        { error: "Insufficient balance in petty cash fund" },
        { status: 400 },
      );
    }

    const newBalance =
      transactionType === "EXPENSE"
        ? currentBalance - numAmount
        : currentBalance + numAmount;

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
    // Append a timestamp suffix to reduce (but not eliminate) race-condition collisions;
    // the unique constraint on transactionCode provides the definitive guard.
    const transactionCode = `CM-${String(nextNum).padStart(6, "0")}-${Date.now().toString(36).toUpperCase()}`;

    const [newTx] = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .insert(pettyCashTransactions)
        .values({
          transactionCode,
          fundId,
          transactionDate,
          transactionType,
          category: category || null,
          description,
          amount: String(numAmount),
          balanceBefore: String(currentBalance),
          balanceAfter: String(newBalance),
          referenceCode: referenceCode || null,
          notes: notes || null,
        })
        .returning();

      await tx
        .update(pettyCashFunds)
        .set({ currentBalance: String(newBalance), updatedAt: new Date() })
        .where(eq(pettyCashFunds.id, fundId));

      return [transaction];
    });

    return Response.json(newTx, { status: 201 });
  } catch (error) {
    return dbErrorResponse(error);
  }
}
