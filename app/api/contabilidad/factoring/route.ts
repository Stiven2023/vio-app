import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, factoringRecords, preInvoices } from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { createNotificationsForPermission } from "@/src/utils/notifications";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

type FactoringStatus = "ACTIVE" | "COLLECTED" | "VOIDED";

const STATUS_VALUES = new Set<FactoringStatus>([
  "ACTIVE",
  "COLLECTED",
  "VOIDED",
]);

function parseMoney(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return null;

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

async function generateFactoringCode(tx: any) {
  const [countRow] = await tx
    .select({ total: sql<number>`count(*)::int` })
    .from(factoringRecords);

  let sequence = (countRow?.total ?? 0) + 1;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = `FAC-${String(sequence).padStart(6, "0")}`;
    const [existing] = await tx
      .select({ id: factoringRecords.id })
      .from(factoringRecords)
      .where(eq(factoringRecords.factoringCode, code))
      .limit(1);

    if (!existing?.id) return code;

    sequence += 1;
  }

  return `FAC-${Date.now().toString().slice(-8)}`;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "factoring:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_FACTORING");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const clientId = String(searchParams.get("clientId") ?? "").trim();
    const status = String(searchParams.get("status") ?? "ALL")
      .trim()
      .toUpperCase();
    const dateFrom = String(searchParams.get("dateFrom") ?? "").trim();
    const dateTo = String(searchParams.get("dateTo") ?? "").trim();

    const clauses = [] as Array<any>;

    if (clientId) clauses.push(eq(factoringRecords.clientId, clientId));
    if (STATUS_VALUES.has(status as FactoringStatus)) {
      clauses.push(eq(factoringRecords.status, status as FactoringStatus));
    }
    if (dateFrom) {
      clauses.push(
        sql`date(${factoringRecords.assignmentDate}) >= ${dateFrom}::date`,
      );
    }
    if (dateTo) {
      clauses.push(
        sql`date(${factoringRecords.assignmentDate}) <= ${dateTo}::date`,
      );
    }

    const where = clauses.length > 0 ? and(...clauses) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(factoringRecords)
      .where(where);

    const rows = await db
      .select({
        id: factoringRecords.id,
        factoringCode: factoringRecords.factoringCode,
        clientId: factoringRecords.clientId,
        clientName: clients.name,
        prefacturaId: factoringRecords.prefacturaId,
        prefacturaCode: preInvoices.prefacturaCode,
        factoringEntity: factoringRecords.factoringEntity,
        assignmentDate: factoringRecords.assignmentDate,
        invoiceValue: factoringRecords.invoiceValue,
        discountRate: factoringRecords.discountRate,
        netAmountReceived: factoringRecords.netAmountReceived,
        status: factoringRecords.status,
        notes: factoringRecords.notes,
        createdAt: factoringRecords.createdAt,
      })
      .from(factoringRecords)
      .innerJoin(clients, eq(factoringRecords.clientId, clients.id))
      .innerJoin(preInvoices, eq(factoringRecords.prefacturaId, preInvoices.id))
      .where(where)
      .orderBy(
        desc(factoringRecords.assignmentDate),
        desc(factoringRecords.createdAt),
      )
      .limit(pageSize)
      .offset(offset);

    const [summary] = await db
      .select({
        totalFactored: sql<string>`coalesce(sum(case when ${factoringRecords.status} = 'ACTIVE' then ${factoringRecords.invoiceValue} else 0 end), 0)::text`,
        totalNetReceived: sql<string>`coalesce(sum(${factoringRecords.netAmountReceived}), 0)::text`,
        totalDiscountCost: sql<string>`coalesce(sum(${factoringRecords.invoiceValue} - ${factoringRecords.netAmountReceived}), 0)::text`,
      })
      .from(factoringRecords)
      .where(where);

    const clientOptions = await db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(eq(clients.isActive, true))
      .orderBy(asc(clients.name));

    const prefacturaOptions = await db
      .select({
        id: preInvoices.id,
        prefacturaCode: preInvoices.prefacturaCode,
        clientId: preInvoices.clientId,
        clientName: clients.name,
        invoiceValue: preInvoices.total,
      })
      .from(preInvoices)
      .innerJoin(clients, eq(preInvoices.clientId, clients.id))
      .leftJoin(
        factoringRecords,
        eq(factoringRecords.prefacturaId, preInvoices.id),
      )
      .where(
        and(
          eq(preInvoices.paymentType, "CREDIT" as any),
          isNull(factoringRecords.id),
        ),
      )
      .orderBy(desc(preInvoices.createdAt));

    return Response.json({
      items: rows,
      clients: clientOptions,
      prefacturaOptions,
      summary: {
        totalFactored: String(summary?.totalFactored ?? "0"),
        totalNetReceived: String(summary?.totalNetReceived ?? "0"),
        totalDiscountCost: String(summary?.totalDiscountCost ?? "0"),
      },
      page,
      pageSize,
      total,
      hasNextPage: offset + rows.length < total,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo consultar factoring", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "factoring:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_FACTORING");

  if (forbidden) return forbidden;

  try {
    const body = await request.json();

    const prefacturaId = String(body?.prefacturaId ?? "").trim();
    const factoringEntity = String(body?.factoringEntity ?? "").trim();
    const assignmentDate = parseDate(body?.assignmentDate);
    const discountRate = parseMoney(body?.discountRate);
    const notes = String(body?.notes ?? "").trim();

    if (!prefacturaId)
      return new Response("prefacturaId required", { status: 400 });
    if (!factoringEntity) {
      return new Response("factoringEntity required", { status: 400 });
    }
    if (!assignmentDate) {
      return new Response("assignmentDate invalid", { status: 400 });
    }
    if (discountRate === null || discountRate < 0 || discountRate > 100) {
      return new Response("discountRate invalid", { status: 400 });
    }

    const [exists] = await db
      .select({ id: factoringRecords.id })
      .from(factoringRecords)
      .where(eq(factoringRecords.prefacturaId, prefacturaId))
      .limit(1);

    if (exists?.id) {
      return new Response("La prefactura ya fue asignada a factoring", {
        status: 409,
      });
    }

    const [prefacturaRow] = await db
      .select({
        id: preInvoices.id,
        prefacturaCode: preInvoices.prefacturaCode,
        paymentType: preInvoices.paymentType,
        invoiceValue: preInvoices.total,
        clientId: preInvoices.clientId,
      })
      .from(preInvoices)
      .where(eq(preInvoices.id, prefacturaId))
      .limit(1);

    if (!prefacturaRow?.id) {
      return new Response("Prefactura no encontrada", { status: 404 });
    }

    if (String(prefacturaRow.paymentType ?? "") !== "CREDIT") {
      return new Response("Solo se permiten prefacturas con pago a credito", {
        status: 400,
      });
    }

    if (!prefacturaRow.clientId) {
      return new Response("La prefactura no tiene cliente asociado", {
        status: 400,
      });
    }

    const clientId = String(prefacturaRow.clientId);

    const invoiceValue = Number(prefacturaRow.invoiceValue ?? 0);

    if (!Number.isFinite(invoiceValue) || invoiceValue < 0) {
      return new Response("Valor de prefactura invalido", { status: 400 });
    }

    const netAmount = invoiceValue - (invoiceValue * discountRate) / 100;
    const employeeId = getEmployeeIdFromRequest(request);

    const created = await db.transaction(async (tx) => {
      const factoringCode = await generateFactoringCode(tx);

      const [row] = await tx
        .insert(factoringRecords)
        .values({
          factoringCode,
          prefacturaId,
          clientId,
          factoringEntity,
          assignmentDate,
          discountRate: toMoneyString(discountRate),
          invoiceValue: toMoneyString(invoiceValue),
          netAmountReceived: toMoneyString(netAmount),
          status: "ACTIVE",
          notes: notes || null,
          createdBy: employeeId,
        })
        .returning({
          id: factoringRecords.id,
          factoringCode: factoringRecords.factoringCode,
        });

      return row;
    });

    void createNotificationsForPermission("VER_FACTORING", {
      title: "Registro de factoring creado",
      message: `Se creó el registro de factoring ${created.factoringCode}.`,
      href: `/erp/contabilidad/factoring`,
    });

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo crear el registro de factoring", {
      status: 500,
    });
  }
}
