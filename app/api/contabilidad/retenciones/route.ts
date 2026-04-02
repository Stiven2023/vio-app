import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { taxZoneValues } from "@/src/db/enums";
import { clients, preInvoices, taxZoneRates } from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

type TaxZone = (typeof taxZoneValues)[number];

function parseDate(value: unknown) {
  const text = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  return text;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "retenciones:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_RETENCIONES");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const query = String(searchParams.get("query") ?? "").trim();
    const clientId = String(searchParams.get("clientId") ?? "").trim();
    const taxZone = String(searchParams.get("taxZone") ?? "")
      .trim()
      .toUpperCase();
    const dateFrom = parseDate(searchParams.get("dateFrom"));
    const dateTo = parseDate(searchParams.get("dateTo"));

    const taxRateExpr = sql`coalesce(${taxZoneRates.withholdingTaxRate}, 0)::numeric`;
    const icaRateExpr = sql`coalesce(${taxZoneRates.withholdingIcaRate}, 0)::numeric`;
    const ivaRateExpr = sql`coalesce(${taxZoneRates.withholdingIvaRate}, 0)::numeric`;
    const subtotalExpr = sql`coalesce(${preInvoices.subtotal}, 0)::numeric`;
    const ivaAmountExpr = sql`coalesce(${preInvoices.ivaAmount}, 0)::numeric`;
    const withholdingTaxExpr = sql`round(${subtotalExpr} * ${taxRateExpr} / 100, 2)`;
    const withholdingIcaExpr = sql`round(${subtotalExpr} * ${icaRateExpr} / 100, 2)`;
    const withholdingIvaExpr = sql`round(${ivaAmountExpr} * ${ivaRateExpr} / 100, 2)`;
    const withholdingTotalExpr = sql`${withholdingTaxExpr} + ${withholdingIcaExpr} + ${withholdingIvaExpr}`;

    const clauses = [] as Array<any>;

    if (query) {
      clauses.push(
        sql`(
          ${preInvoices.prefacturaCode} ilike ${`%${query}%`}
          or ${clients.name} ilike ${`%${query}%`}
          or ${clients.identification} ilike ${`%${query}%`}
        )`,
      );
    }
    if (clientId) clauses.push(eq(preInvoices.clientId, clientId));
    if (taxZoneValues.includes(taxZone as TaxZone)) {
      clauses.push(eq(clients.taxZone, taxZone as TaxZone));
    }
    if (dateFrom) {
      clauses.push(sql`date(${preInvoices.createdAt}) >= ${dateFrom}::date`);
    }
    if (dateTo) {
      clauses.push(sql`date(${preInvoices.createdAt}) <= ${dateTo}::date`);
    }

    clauses.push(sql`${withholdingTotalExpr} > 0`);

    const where = and(...clauses);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(preInvoices)
      .innerJoin(clients, eq(preInvoices.clientId, clients.id))
      .leftJoin(taxZoneRates, eq(clients.taxZone, taxZoneRates.taxZone))
      .where(where);

    const items = await db
      .select({
        id: preInvoices.id,
        prefacturaCode: preInvoices.prefacturaCode,
        createdAt: preInvoices.createdAt,
        clientId: clients.id,
        clientName: clients.name,
        clientIdentification: clients.identification,
        taxZone: clients.taxZone,
        subtotal: preInvoices.subtotal,
        ivaAmount: preInvoices.ivaAmount,
        total: preInvoices.total,
        withholdingTaxRate: taxRateExpr,
        withholdingIcaRate: icaRateExpr,
        withholdingIvaRate: ivaRateExpr,
        withholdingTaxAmount: withholdingTaxExpr,
        withholdingIcaAmount: withholdingIcaExpr,
        withholdingIvaAmount: withholdingIvaExpr,
        totalWithholding: withholdingTotalExpr,
        totalAfterWithholding: sql`coalesce(${preInvoices.total}, 0)::numeric - (${withholdingTotalExpr})`,
      })
      .from(preInvoices)
      .innerJoin(clients, eq(preInvoices.clientId, clients.id))
      .leftJoin(taxZoneRates, eq(clients.taxZone, taxZoneRates.taxZone))
      .where(where)
      .orderBy(desc(preInvoices.createdAt), asc(preInvoices.prefacturaCode))
      .limit(pageSize)
      .offset(offset);

    const [summary] = await db
      .select({
        totalBase: sql<string>`coalesce(sum(${subtotalExpr}), 0)::text`,
        totalIvaBase: sql<string>`coalesce(sum(${ivaAmountExpr}), 0)::text`,
        totalReteFuente: sql<string>`coalesce(sum(${withholdingTaxExpr}), 0)::text`,
        totalReteIca: sql<string>`coalesce(sum(${withholdingIcaExpr}), 0)::text`,
        totalReteIva: sql<string>`coalesce(sum(${withholdingIvaExpr}), 0)::text`,
        totalWithholding: sql<string>`coalesce(sum(${withholdingTotalExpr}), 0)::text`,
      })
      .from(preInvoices)
      .innerJoin(clients, eq(preInvoices.clientId, clients.id))
      .leftJoin(taxZoneRates, eq(clients.taxZone, taxZoneRates.taxZone))
      .where(where);

    const clientsOptions = await db
      .select({ id: clients.id, name: clients.name, taxZone: clients.taxZone })
      .from(clients)
      .where(eq(clients.isActive, true))
      .orderBy(asc(clients.name));

    return Response.json({
      items,
      clients: clientsOptions,
      taxZones: taxZoneValues,
      summary: {
        totalBase: String(summary?.totalBase ?? "0"),
        totalIvaBase: String(summary?.totalIvaBase ?? "0"),
        totalReteFuente: String(summary?.totalReteFuente ?? "0"),
        totalReteIca: String(summary?.totalReteIca ?? "0"),
        totalReteIva: String(summary?.totalReteIva ?? "0"),
        totalWithholding: String(summary?.totalWithholding ?? "0"),
      },
      page,
      pageSize,
      total,
      hasNextPage: offset + items.length < total,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo consultar retenciones", { status: 500 });
  }
}
