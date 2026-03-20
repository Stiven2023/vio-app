import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  cashReceiptApplications,
  cashReceipts,
  clients,
  prefacturas,
} from "@/src/db/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

type UiPaymentMethod = "CASH" | "TRANSFER" | "CREDIT";

const METHOD_TO_DB: Record<
  UiPaymentMethod,
  "EFECTIVO" | "TRANSFERENCIA" | "CREDITO"
> = {
  CASH: "EFECTIVO",
  TRANSFER: "TRANSFERENCIA",
  CREDIT: "CREDITO",
};

function mapDbMethodToUi(value: unknown): UiPaymentMethod {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase();

  if (normalized === "TRANSFERENCIA") return "TRANSFER";
  if (normalized === "CREDITO") return "CREDIT";

  return "CASH";
}

function parseMoney(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return parsed;
}

function toMoneyString(value: number) {
  return value.toFixed(2);
}

function parseDate(value: unknown) {
  const text = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  return text;
}

function prefacturaAmountExpr() {
  return sql`case when coalesce(${prefacturas.totalAfterWithholdings}, 0) > 0 then coalesce(${prefacturas.totalAfterWithholdings}, 0) else coalesce(${prefacturas.total}, 0) end`;
}

async function generateReceiptCode(tx: any) {
  const [countRow] = await tx
    .select({ total: sql<number>`count(*)::int` })
    .from(cashReceipts);

  let sequence = (countRow?.total ?? 0) + 1;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = `RC-${String(sequence).padStart(6, "0")}`;
    const [existing] = await tx
      .select({ id: cashReceipts.id })
      .from(cashReceipts)
      .where(eq(cashReceipts.receiptCode, code))
      .limit(1);

    if (!existing?.id) return code;

    sequence += 1;
  }

  return `RC-${Date.now().toString().slice(-8)}`;
}

async function getOutstandingBalances(prefacturaIds: string[]) {
  if (prefacturaIds.length === 0) return new Map<string, number>();

  const totalExpr = prefacturaAmountExpr();
  const rows = await db
    .select({
      id: prefacturas.id,
      total: totalExpr,
      applied: sql<string>`coalesce(sum(case when ${cashReceipts.status} = 'CONFIRMED' then ${cashReceiptApplications.appliedAmount} else 0 end), 0)::text`,
    })
    .from(prefacturas)
    .leftJoin(
      cashReceiptApplications,
      eq(cashReceiptApplications.prefacturaId, prefacturas.id),
    )
    .leftJoin(
      cashReceipts,
      eq(cashReceiptApplications.cashReceiptId, cashReceipts.id),
    )
    .where(inArray(prefacturas.id, prefacturaIds))
    .groupBy(prefacturas.id);

  return new Map(
    rows.map((row) => {
      const total = Number(row.total ?? 0);
      const applied = Number(row.applied ?? 0);

      return [row.id, Math.max(0, total - applied)];
    }),
  );
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "cash-receipts:get",
    limit: 150,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_RECIBO_CAJA");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const clientId = String(searchParams.get("clientId") ?? "").trim();
    const paymentMethod = String(searchParams.get("paymentMethod") ?? "ALL")
      .trim()
      .toUpperCase();
    const status = String(searchParams.get("status") ?? "ALL")
      .trim()
      .toUpperCase();
    const dateFrom = parseDate(searchParams.get("dateFrom"));
    const dateTo = parseDate(searchParams.get("dateTo"));

    const filters = [] as Array<any>;

    if (clientId) filters.push(eq(cashReceipts.clientId, clientId));
    if (paymentMethod in METHOD_TO_DB) {
      filters.push(
        eq(
          cashReceipts.paymentMethod,
          METHOD_TO_DB[paymentMethod as UiPaymentMethod],
        ),
      );
    }
    if (status === "PENDING" || status === "CONFIRMED" || status === "VOIDED") {
      filters.push(eq(cashReceipts.status, status as any));
    }
    if (dateFrom) {
      filters.push(sql`date(${cashReceipts.receiptDate}) >= ${dateFrom}::date`);
    }
    if (dateTo) {
      filters.push(sql`date(${cashReceipts.receiptDate}) <= ${dateTo}::date`);
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(cashReceipts)
      .where(where);

    const rows = await db
      .select({
        id: cashReceipts.id,
        receiptCode: cashReceipts.receiptCode,
        clientId: cashReceipts.clientId,
        clientName: clients.name,
        prefacturaId: cashReceipts.prefacturaId,
        orderId: cashReceipts.orderId,
        receiptDate: cashReceipts.receiptDate,
        amountReceived: cashReceipts.amountReceived,
        paymentMethod: cashReceipts.paymentMethod,
        includesIva: cashReceipts.includesIva,
        originBank: cashReceipts.originBank,
        referenceNumber: cashReceipts.referenceNumber,
        creditBalance: cashReceipts.creditBalance,
        status: cashReceipts.status,
        notes: cashReceipts.notes,
        createdAt: cashReceipts.createdAt,
      })
      .from(cashReceipts)
      .innerJoin(clients, eq(cashReceipts.clientId, clients.id))
      .where(where)
      .orderBy(desc(cashReceipts.receiptDate), desc(cashReceipts.createdAt))
      .limit(pageSize)
      .offset(offset);

    const receiptIds = rows.map((row) => row.id);
    const applicationRows =
      receiptIds.length > 0
        ? await db
            .select({
              id: cashReceiptApplications.id,
              cashReceiptId: cashReceiptApplications.cashReceiptId,
              prefacturaId: cashReceiptApplications.prefacturaId,
              prefacturaCode: prefacturas.prefacturaCode,
              appliedAmount: cashReceiptApplications.appliedAmount,
            })
            .from(cashReceiptApplications)
            .innerJoin(
              prefacturas,
              eq(cashReceiptApplications.prefacturaId, prefacturas.id),
            )
            .where(inArray(cashReceiptApplications.cashReceiptId, receiptIds))
            .orderBy(asc(prefacturas.prefacturaCode))
        : [];

    const applicationsByReceipt = new Map<string, typeof applicationRows>();

    for (const application of applicationRows) {
      const current =
        applicationsByReceipt.get(application.cashReceiptId) ?? [];

      current.push(application);
      applicationsByReceipt.set(application.cashReceiptId, current);
    }

    const [summary] = await db
      .select({
        totalToday: sql<string>`coalesce(sum(case when ${cashReceipts.status} <> 'VOIDED' and ${cashReceipts.receiptDate} = current_date then ${cashReceipts.amountReceived} else 0 end), 0)::text`,
        totalMonth: sql<string>`coalesce(sum(case when ${cashReceipts.status} <> 'VOIDED' and date_trunc('month', ${cashReceipts.receiptDate}::timestamp) = date_trunc('month', current_date::timestamp) then ${cashReceipts.amountReceived} else 0 end), 0)::text`,
        pendingCount: sql<number>`coalesce(sum(case when ${cashReceipts.status} = 'PENDING' then 1 else 0 end), 0)::int`,
      })
      .from(cashReceipts)
      .where(where);

    const clientOptions = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(eq(clients.isActive, true))
      .orderBy(asc(clients.name));

    return Response.json({
      items: rows.map((row) => ({
        ...row,
        paymentMethod: mapDbMethodToUi(row.paymentMethod),
        applications: applicationsByReceipt.get(row.id) ?? [],
      })),
      clients: clientOptions,
      summary: {
        totalToday: String(summary?.totalToday ?? "0"),
        totalMonth: String(summary?.totalMonth ?? "0"),
        pendingCount: Number(summary?.pendingCount ?? 0),
      },
      page,
      pageSize,
      total,
      hasNextPage: offset + rows.length < total,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar los recibos de caja", {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "cash-receipts:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_RECIBO_CAJA");

  if (forbidden) return forbidden;

  try {
    const body = await request.json();

    const clientId = String(body?.clientId ?? "").trim();
    const receiptDate = parseDate(body?.receiptDate);
    const amountReceived = parseMoney(body?.amountReceived);
    const paymentMethod = String(body?.paymentMethod ?? "")
      .trim()
      .toUpperCase() as UiPaymentMethod;
    const includesIva = Boolean(body?.includesIva);
    const originBank = String(body?.originBank ?? "").trim();
    const referenceNumber = String(body?.referenceNumber ?? "").trim();
    const notes = String(body?.notes ?? "").trim();
    const prefacturaIds = Array.isArray(body?.prefacturaIds)
      ? body.prefacturaIds
          .map((value: unknown) => String(value ?? "").trim())
          .filter(Boolean)
      : [];
    const applications = Array.isArray(body?.applications)
      ? body.applications
          .map((item: any) => ({
            prefacturaId: String(item?.prefacturaId ?? "").trim(),
            appliedAmount: parseMoney(item?.appliedAmount),
          }))
          .filter(
            (item: { prefacturaId: string; appliedAmount: number | null }) =>
              item.prefacturaId,
          )
      : [];

    if (!clientId) return new Response("clientId required", { status: 400 });
    if (!receiptDate) {
      return new Response("receiptDate invalid", { status: 400 });
    }
    if (amountReceived === null || amountReceived <= 0) {
      return new Response("amountReceived invalid", { status: 400 });
    }
    if (!(paymentMethod in METHOD_TO_DB)) {
      return new Response("paymentMethod invalid", { status: 400 });
    }

    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client?.id) {
      return new Response("Cliente no encontrado", { status: 404 });
    }

    const appliedTotal = applications.reduce(
      (
        acc: number,
        item: { prefacturaId: string; appliedAmount: number | null },
      ) => {
        const amount = Number(item.appliedAmount ?? 0);

        return acc + (Number.isFinite(amount) ? amount : 0);
      },
      0,
    );

    if (appliedTotal > amountReceived + 0.0001) {
      return new Response(
        "La suma aplicada no puede exceder el valor recibido",
        {
          status: 400,
        },
      );
    }

    const uniquePrefacturaIds: string[] = Array.from(new Set(prefacturaIds));

    if (
      applications.some(
        (item: { prefacturaId: string; appliedAmount: number | null }) =>
          item.appliedAmount === null || Number(item.appliedAmount) < 0,
      )
    ) {
      return new Response("Hay montos aplicados invalidos", { status: 400 });
    }

    if (
      applications.some(
        (item: { prefacturaId: string; appliedAmount: number | null }) =>
          !uniquePrefacturaIds.includes(item.prefacturaId),
      )
    ) {
      return new Response(
        "Las aplicaciones deben corresponder a las prefacturas seleccionadas",
        {
          status: 400,
        },
      );
    }

    const selectedPrefacturas =
      uniquePrefacturaIds.length > 0
        ? await db
            .select({
              id: prefacturas.id,
              prefacturaCode: prefacturas.prefacturaCode,
              clientId: prefacturas.clientId,
              orderId: prefacturas.orderId,
            })
            .from(prefacturas)
            .where(inArray(prefacturas.id, uniquePrefacturaIds))
        : [];

    if (selectedPrefacturas.length !== uniquePrefacturaIds.length) {
      return new Response("Hay prefacturas seleccionadas que no existen", {
        status: 404,
      });
    }

    if (
      selectedPrefacturas.some((row) => String(row.clientId ?? "") !== clientId)
    ) {
      return new Response("Todas las prefacturas deben pertenecer al cliente", {
        status: 400,
      });
    }

    const outstandingByPrefactura =
      await getOutstandingBalances(uniquePrefacturaIds);

    for (const application of applications) {
      const outstanding =
        outstandingByPrefactura.get(application.prefacturaId) ?? 0;
      const amount = Number(application.appliedAmount ?? 0);

      if (amount > outstanding + 0.0001) {
        return new Response(
          "Una aplicacion excede el saldo pendiente de la prefactura",
          {
            status: 409,
          },
        );
      }
    }

    const employeeId = getEmployeeIdFromRequest(request);
    const primaryPrefactura = selectedPrefacturas[0] ?? null;
    const creditBalance = Math.max(0, amountReceived - appliedTotal);

    const created = await db.transaction(async (tx) => {
      const receiptCode = await generateReceiptCode(tx);

      const [receipt] = await tx
        .insert(cashReceipts)
        .values({
          receiptCode,
          clientId,
          prefacturaId: primaryPrefactura?.id ?? null,
          orderId: primaryPrefactura?.orderId ?? null,
          receiptDate,
          amountReceived: toMoneyString(amountReceived),
          paymentMethod: METHOD_TO_DB[paymentMethod],
          includesIva: paymentMethod === "TRANSFER" ? includesIva : false,
          originBank: paymentMethod === "TRANSFER" ? originBank || null : null,
          referenceNumber:
            paymentMethod === "TRANSFER" ? referenceNumber || null : null,
          creditBalance: toMoneyString(creditBalance),
          status: "PENDING",
          notes: notes || null,
          createdBy: employeeId,
        })
        .returning({
          id: cashReceipts.id,
          receiptCode: cashReceipts.receiptCode,
        });

      if (applications.length > 0) {
        await tx.insert(cashReceiptApplications).values(
          applications
            .filter(
              (item: { prefacturaId: string; appliedAmount: number | null }) =>
                Number(item.appliedAmount ?? 0) > 0,
            )
            .map(
              (item: {
                prefacturaId: string;
                appliedAmount: number | null;
              }) => ({
                cashReceiptId: receipt.id,
                prefacturaId: item.prefacturaId,
                appliedAmount: toMoneyString(Number(item.appliedAmount ?? 0)),
              }),
            ),
        );
      }

      return receipt;
    });

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response(
      error instanceof Error
        ? error.message
        : "No se pudo crear el recibo de caja",
      {
        status: 500,
      },
    );
  }
}
