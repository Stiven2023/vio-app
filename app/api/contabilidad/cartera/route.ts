import { and, asc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, prefacturas } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

type PaymentType = "CASH" | "CREDIT";
type AgingBucket = "CURRENT" | "1_30" | "31_60" | "61_90" | "90_PLUS";
type CreditBackingType =
  | "PROMISSORY_NOTE"
  | "PURCHASE_ORDER"
  | "VERBAL_AGREEMENT";

const VALID_AGING_BUCKETS = new Set<AgingBucket>([
  "CURRENT",
  "1_30",
  "31_60",
  "61_90",
  "90_PLUS",
]);

const VALID_CREDIT_BACKING = new Set<CreditBackingType>([
  "PROMISSORY_NOTE",
  "PURCHASE_ORDER",
  "VERBAL_AGREEMENT",
]);

function prefacturaAmountExpr() {
  return sql<string>`case when coalesce(${prefacturas.totalAfterWithholdings}, 0) > 0 then coalesce(${prefacturas.totalAfterWithholdings}, 0) else coalesce(${prefacturas.total}, 0) end`;
}

function daysOverdueExpr() {
  return sql<number>`case when ${prefacturas.dueDate} is null then null else extract(day from (current_date - ${prefacturas.dueDate}::date))::int end`;
}

function agingBucketSqlExpr() {
  return sql<string>`case
    when ${prefacturas.dueDate} is null then 'CURRENT'
    when current_date <= ${prefacturas.dueDate}::date then 'CURRENT'
    when extract(day from (current_date - ${prefacturas.dueDate}::date)) <= 30 then '1_30'
    when extract(day from (current_date - ${prefacturas.dueDate}::date)) <= 60 then '31_60'
    when extract(day from (current_date - ${prefacturas.dueDate}::date)) <= 90 then '61_90'
    else '90_PLUS'
  end`;
}

function agingBucketClause(bucket: AgingBucket) {
  switch (bucket) {
    case "CURRENT":
      return sql`(${prefacturas.dueDate} is null or current_date <= ${prefacturas.dueDate}::date)`;
    case "1_30":
      return sql`(${prefacturas.dueDate} is not null and current_date > ${prefacturas.dueDate}::date and extract(day from (current_date - ${prefacturas.dueDate}::date)) <= 30)`;
    case "31_60":
      return sql`(${prefacturas.dueDate} is not null and extract(day from (current_date - ${prefacturas.dueDate}::date)) > 30 and extract(day from (current_date - ${prefacturas.dueDate}::date)) <= 60)`;
    case "61_90":
      return sql`(${prefacturas.dueDate} is not null and extract(day from (current_date - ${prefacturas.dueDate}::date)) > 60 and extract(day from (current_date - ${prefacturas.dueDate}::date)) <= 90)`;
    case "90_PLUS":
      return sql`(${prefacturas.dueDate} is not null and extract(day from (current_date - ${prefacturas.dueDate}::date)) > 90)`;
  }
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "cartera:get",
    limit: 150,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CARTERA");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const rawPaymentType = String(searchParams.get("paymentType") ?? "CASH")
      .trim()
      .toUpperCase();

    const paymentType: PaymentType =
      rawPaymentType === "CREDIT" ? "CREDIT" : "CASH";

    const clientId = String(searchParams.get("clientId") ?? "").trim();
    const dateFrom = String(searchParams.get("dateFrom") ?? "").trim();
    const dateTo = String(searchParams.get("dateTo") ?? "").trim();

    const rawAgingBucket = String(searchParams.get("agingBucket") ?? "")
      .trim()
      .toUpperCase();

    const agingBucket = VALID_AGING_BUCKETS.has(rawAgingBucket as AgingBucket)
      ? (rawAgingBucket as AgingBucket)
      : null;

    const rawCreditBacking = String(searchParams.get("creditBackingType") ?? "")
      .trim()
      .toUpperCase();

    const creditBackingType = VALID_CREDIT_BACKING.has(
      rawCreditBacking as CreditBackingType,
    )
      ? (rawCreditBacking as CreditBackingType)
      : null;

    const clauses: ReturnType<typeof sql>[] = [
      sql`${prefacturas.paymentType} = ${paymentType}`,
      sql`${prefacturas.clientId} is not null`,
    ];

    if (clientId) {
      clauses.push(sql`${prefacturas.clientId} = ${clientId}::uuid`);
    }

    if (dateFrom) {
      clauses.push(gte(prefacturas.approvedAt, new Date(dateFrom)));
    }

    if (dateTo) {
      const toDate = new Date(dateTo);

      toDate.setHours(23, 59, 59, 999);
      clauses.push(lte(prefacturas.approvedAt, toDate));
    }

    if (creditBackingType && paymentType === "CREDIT") {
      clauses.push(sql`${clients.creditBackingType} = ${creditBackingType}`);
    }

    if (agingBucket && paymentType === "CREDIT") {
      clauses.push(agingBucketClause(agingBucket));
    }

    const where = and(...clauses);
    const amountExpr = prefacturaAmountExpr();
    const appliedExpr = sql<string>`coalesce((select sum(cra.applied_amount) from cash_receipt_applications cra join cash_receipts cr on cra.cash_receipt_id = cr.id where cra.prefactura_id = ${prefacturas.id} and cr.status = 'CONFIRMED'), 0)::text`;

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(prefacturas)
      .leftJoin(clients, eq(prefacturas.clientId, clients.id))
      .where(where);

    const total = countRow?.count ?? 0;

    const items = await db
      .select({
        id: prefacturas.id,
        prefacturaCode: prefacturas.prefacturaCode,
        approvedAt: prefacturas.approvedAt,
        dueDate: prefacturas.dueDate,
        paymentType: prefacturas.paymentType,
        totalAmount: amountExpr,
        amountPaid: appliedExpr,
        clientId: clients.id,
        clientName: clients.name,
        creditBackingType: clients.creditBackingType,
        daysOverdue: daysOverdueExpr(),
        agingBucket: agingBucketSqlExpr(),
      })
      .from(prefacturas)
      .leftJoin(clients, eq(prefacturas.clientId, clients.id))
      .where(where)
      .orderBy(asc(prefacturas.dueDate), asc(prefacturas.approvedAt))
      .limit(pageSize)
      .offset(offset);

    const mappedItems = items.map((row) => {
      const totalAmt = Number(row.totalAmount ?? 0);
      const paid = Number(row.amountPaid ?? 0);
      const balanceDue = Math.max(0, totalAmt - paid);

      return {
        ...row,
        totalAmount: totalAmt.toFixed(2),
        amountPaid: paid.toFixed(2),
        balanceDue: balanceDue.toFixed(2),
      };
    });

    const clientOptions = await db
      .selectDistinct({ id: clients.id, name: clients.name })
      .from(prefacturas)
      .innerJoin(clients, eq(prefacturas.clientId, clients.id))
      .where(sql`${prefacturas.paymentType} = ${paymentType}`)
      .orderBy(asc(clients.name));

    let summary: Record<string, string> | null = null;

    if (paymentType === "CREDIT") {
      const summaryRows = await db
        .select({
          bucket: agingBucketSqlExpr(),
          totalBalance: sql<string>`sum(greatest(0, case when coalesce(${prefacturas.totalAfterWithholdings}, 0) > 0 then coalesce(${prefacturas.totalAfterWithholdings}, 0) else coalesce(${prefacturas.total}, 0) end - coalesce((select sum(cra2.applied_amount) from cash_receipt_applications cra2 join cash_receipts cr2 on cra2.cash_receipt_id = cr2.id where cra2.prefactura_id = ${prefacturas.id} and cr2.status = 'CONFIRMED'), 0)))::text`,
        })
        .from(prefacturas)
        .leftJoin(clients, eq(prefacturas.clientId, clients.id))
        .where(where)
        .groupBy(agingBucketSqlExpr());

      const buckets: Record<AgingBucket, number> = {
        CURRENT: 0,
        "1_30": 0,
        "31_60": 0,
        "61_90": 0,
        "90_PLUS": 0,
      };

      for (const row of summaryRows) {
        const bucket = row.bucket as AgingBucket;

        if (bucket in buckets) {
          buckets[bucket] = Number(row.totalBalance ?? 0);
        }
      }

      const grandTotal = Object.values(buckets).reduce((acc, v) => acc + v, 0);

      summary = {
        current: buckets.CURRENT.toFixed(2),
        d1_30: buckets["1_30"].toFixed(2),
        d31_60: buckets["31_60"].toFixed(2),
        d61_90: buckets["61_90"].toFixed(2),
        d90plus: buckets["90_PLUS"].toFixed(2),
        grandTotal: grandTotal.toFixed(2),
      };
    }

    return Response.json({
      items: mappedItems,
      clients: clientOptions,
      summary,
      page,
      pageSize,
      total,
      hasNextPage: offset + pageSize < total,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo consultar cartera", { status: 500 });
  }
}
