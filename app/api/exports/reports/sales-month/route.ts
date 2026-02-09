import * as XLSX from "xlsx";
import { and, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, orderPayments, orders } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { aoaSheet, workbookToXlsxResponse } from "@/src/utils/xlsx-export";

function toMonthRange(year?: number, month?: number) {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1;
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);

  return { start, end, year: y, month: m };
}

function formatDate(value: unknown) {
  const d = new Date(String(value ?? ""));

  if (Number.isNaN(d.getTime())) return "-";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}/${m}/${day}`;
}

function formatMoney(value: unknown, currency: string) {
  const n = Number(value ?? 0);
  const cur = currency === "USD" ? "USD" : "COP";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: cur === "USD" ? 2 : 0,
    maximumFractionDigits: cur === "USD" ? 2 : 0,
  }).format(Number.isFinite(n) ? n : 0);
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "exports:sales-month",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year") ?? "");
  const month = Number(searchParams.get("month") ?? "");
  const range = toMonthRange(
    Number.isFinite(year) && year > 0 ? year : undefined,
    Number.isFinite(month) && month > 0 ? month : undefined,
  );

  const payments = await db
    .select({
      id: orderPayments.id,
      orderId: orderPayments.orderId,
      orderCode: orders.orderCode,
      clientName: clients.name,
      amount: orderPayments.amount,
      method: orderPayments.method,
      status: orderPayments.status,
      createdAt: orderPayments.createdAt,
      currency: orders.currency,
    })
    .from(orderPayments)
    .leftJoin(orders, eq(orderPayments.orderId, orders.id))
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .where(
      and(
        gte(orderPayments.createdAt, range.start),
        lte(orderPayments.createdAt, range.end),
        sql`${orderPayments.status} <> 'ANULADO'`,
      ),
    )
    .orderBy(orderPayments.createdAt);

  const totalsByCurrency = new Map<string, number>();
  for (const p of payments) {
    const cur = String(p.currency ?? "COP").toUpperCase();
    const current = totalsByCurrency.get(cur) ?? 0;
    totalsByCurrency.set(cur, current + Number(p.amount ?? 0));
  }

  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "VIOMAR";
  const companyNit = process.env.NEXT_PUBLIC_COMPANY_NIT ?? "-";
  const resumenRows = [
    ["Empresa", companyName],
    ["NIT", companyNit],
    ["Mes", `${range.year}/${String(range.month).padStart(2, "0")}`],
    ["Pagos", payments.length],
    [""],
    ["Totales por moneda"],
    ["Moneda", "Total cobrado"],
    ...Array.from(totalsByCurrency.entries()).map(([cur, total]) => [
      cur,
      formatMoney(total, cur),
    ]),
  ];

  const pagosRows = [
    ["Fecha", "Pedido", "Cliente", "Moneda", "Metodo", "Monto"],
    ...payments.map((p) => {
      const cur = String(p.currency ?? "COP").toUpperCase();

      return [
        p.createdAt ? formatDate(p.createdAt) : "-",
        p.orderCode ?? "-",
        p.clientName ?? "-",
        cur,
        p.method ?? "-",
        formatMoney(p.amount ?? 0, cur),
      ];
    }),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, aoaSheet(resumenRows), "Resumen");
  XLSX.utils.book_append_sheet(wb, aoaSheet(pagosRows), "Pagos");

  const filename = `ventas-${range.year}-${String(range.month).padStart(2, "0")}.xlsx`;

  return workbookToXlsxResponse(wb, filename);
}
