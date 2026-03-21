import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  bankReconciliationItems,
  bankReconciliations,
  banks,
} from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { createNotificationsForPermission } from "@/src/utils/notifications";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

type ReconciliationItemType =
  | "DEPOSIT_IN_TRANSIT"
  | "OUTSTANDING_CHECK"
  | "BANK_DEBIT_NOTE"
  | "BANK_CREDIT_NOTE"
  | "ACCOUNTING_ERROR"
  | "BANK_ERROR";

const ITEM_TYPES = new Set<ReconciliationItemType>([
  "DEPOSIT_IN_TRANSIT",
  "OUTSTANDING_CHECK",
  "BANK_DEBIT_NOTE",
  "BANK_CREDIT_NOTE",
  "ACCOUNTING_ERROR",
  "BANK_ERROR",
]);

function parseMoney(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

function toMoneyString(value: number) {
  return value.toFixed(2);
}

function parsePeriod(value: unknown) {
  const text = String(value ?? "").trim();

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) return null;

  return text;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "bank-reconciliations:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "VER_CONCILIACION_BANCARIA",
  );

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const bankId = String(searchParams.get("bankId") ?? "").trim();
    const period = String(searchParams.get("period") ?? "").trim();
    const status = String(searchParams.get("status") ?? "ALL")
      .trim()
      .toUpperCase();

    const clauses = [] as Array<ReturnType<typeof eq>>;

    if (bankId) clauses.push(eq(bankReconciliations.bankId, bankId));
    if (period) clauses.push(eq(bankReconciliations.period, period));
    if (status === "OPEN")
      clauses.push(eq(bankReconciliations.isClosed, false));
    if (status === "CLOSED")
      clauses.push(eq(bankReconciliations.isClosed, true));

    const where = clauses.length > 0 ? and(...clauses) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(bankReconciliations)
      .where(where);

    const rows = await db
      .select({
        id: bankReconciliations.id,
        period: bankReconciliations.period,
        bankId: bankReconciliations.bankId,
        bankName: banks.name,
        balancePerBank: bankReconciliations.balancePerBank,
        balancePerBooks: bankReconciliations.balancePerBooks,
        difference: bankReconciliations.difference,
        isClosed: bankReconciliations.isClosed,
        closedAt: bankReconciliations.closedAt,
        createdAt: bankReconciliations.createdAt,
      })
      .from(bankReconciliations)
      .innerJoin(banks, eq(bankReconciliations.bankId, banks.id))
      .where(where)
      .orderBy(desc(bankReconciliations.createdAt))
      .limit(pageSize)
      .offset(offset);

    const reconciliationIds = rows.map((row) => row.id);

    const itemRows =
      reconciliationIds.length > 0
        ? await db
            .select({
              id: bankReconciliationItems.id,
              reconciliationId: bankReconciliationItems.reconciliationId,
              itemDate: bankReconciliationItems.itemDate,
              description: bankReconciliationItems.description,
              booksAmount: bankReconciliationItems.booksAmount,
              bankAmount: bankReconciliationItems.bankAmount,
              difference: bankReconciliationItems.difference,
              itemType: bankReconciliationItems.itemType,
            })
            .from(bankReconciliationItems)
            .where(
              inArray(
                bankReconciliationItems.reconciliationId,
                reconciliationIds,
              ),
            )
            .orderBy(
              asc(bankReconciliationItems.itemDate),
              asc(bankReconciliationItems.id),
            )
        : [];

    const itemsByReconciliation = new Map<string, typeof itemRows>();

    for (const item of itemRows) {
      const current = itemsByReconciliation.get(item.reconciliationId) ?? [];

      current.push(item);
      itemsByReconciliation.set(item.reconciliationId, current);
    }

    const bankOptions = await db
      .select({ id: banks.id, name: banks.name })
      .from(banks)
      .where(eq(banks.isActive, true))
      .orderBy(asc(banks.name));

    return Response.json({
      items: rows.map((row) => ({
        ...row,
        status: row.isClosed ? "CLOSED" : "OPEN",
        items: itemsByReconciliation.get(row.id) ?? [],
      })),
      banks: bankOptions,
      page,
      pageSize,
      total,
      hasNextPage: offset + rows.length < total,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar conciliaciones bancarias", {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "bank-reconciliations:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "CREAR_CONCILIACION_BANCARIA",
  );

  if (forbidden) return forbidden;

  try {
    const body = await request.json();

    const bankId = String(body?.bankId ?? "").trim();
    const period = parsePeriod(body?.period);
    const balancePerBank = parseMoney(body?.balancePerBank);
    const balancePerBooks = parseMoney(body?.balancePerBooks);
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!bankId) return new Response("bankId required", { status: 400 });
    if (!period)
      return new Response("period invalid (YYYY-MM)", { status: 400 });
    if (balancePerBank === null) {
      return new Response("balancePerBank must be numeric", { status: 400 });
    }
    if (balancePerBooks === null) {
      return new Response("balancePerBooks must be numeric", { status: 400 });
    }

    const [bankExists] = await db
      .select({ id: banks.id })
      .from(banks)
      .where(eq(banks.id, bankId))
      .limit(1);

    if (!bankExists?.id) return new Response("bank not found", { status: 404 });

    const [periodExists] = await db
      .select({ id: bankReconciliations.id })
      .from(bankReconciliations)
      .where(
        and(
          eq(bankReconciliations.bankId, bankId),
          eq(bankReconciliations.period, period),
        ),
      )
      .limit(1);

    if (periodExists?.id) {
      return new Response(
        "Ya existe una conciliacion para ese banco y periodo",
        {
          status: 409,
        },
      );
    }

    const created = await db.transaction(async (tx) => {
      const difference = balancePerBank - balancePerBooks;

      const [reconciliation] = await tx
        .insert(bankReconciliations)
        .values({
          bankId,
          period,
          balancePerBank: toMoneyString(balancePerBank),
          balancePerBooks: toMoneyString(balancePerBooks),
          difference: toMoneyString(difference),
          isClosed: false,
        })
        .returning({ id: bankReconciliations.id });

      if (!reconciliation?.id) {
        throw new Error("No se pudo crear la conciliacion");
      }

      if (items.length > 0) {
        const normalizedItems = [] as Array<{
          reconciliationId: string;
          itemDate: string;
          description: string;
          booksAmount: string;
          bankAmount: string;
          difference: string;
          itemType: ReconciliationItemType;
        }>;

        for (const rawItem of items) {
          const itemDate = String(rawItem?.itemDate ?? "").trim();
          const description = String(rawItem?.description ?? "").trim();
          const booksAmount = parseMoney(rawItem?.booksAmount);
          const bankAmount = parseMoney(rawItem?.bankAmount);
          const itemType = String(rawItem?.itemType ?? "")
            .trim()
            .toUpperCase() as ReconciliationItemType;

          if (!itemDate) {
            throw new Error("Cada item debe tener fecha");
          }
          if (!description) {
            throw new Error("Cada item debe tener descripcion");
          }
          if (booksAmount === null || bankAmount === null) {
            throw new Error("Los valores de cada item deben ser numericos");
          }
          if (!ITEM_TYPES.has(itemType)) {
            throw new Error("Tipo de item invalido");
          }

          normalizedItems.push({
            reconciliationId: reconciliation.id,
            itemDate,
            description,
            booksAmount: toMoneyString(booksAmount),
            bankAmount: toMoneyString(bankAmount),
            difference: toMoneyString(bankAmount - booksAmount),
            itemType,
          });
        }

        await tx.insert(bankReconciliationItems).values(normalizedItems);
      }

      return reconciliation;
    });

    void createNotificationsForPermission("VER_CONCILIACION_BANCARIA", {
      title: "Conciliación bancaria creada",
      message: `Se creó la conciliación bancaria para el período ${period}.`,
      href: `/erp/contabilidad/conciliaciones-bancarias`,
    });

    return Response.json({ ok: true, id: created.id }, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response(
      error instanceof Error
        ? error.message
        : "No se pudo crear la conciliacion bancaria",
      { status: 400 },
    );
  }
}
