import * as XLSX from "xlsx";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, employees, orderPayments, orders } from "@/src/db/schema";
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
    key: "exports:orders-month",
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

  const ordersRows = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      clientName: clients.name,
      status: orders.status,
      total: orders.total,
      shippingFee: (orders as any).shippingFee,
      currency: orders.currency,
      createdAt: orders.createdAt,
      advisorName: employees.name,
    })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .leftJoin(employees, eq(orders.createdBy, employees.id))
    .where(
      and(
        gte(orders.createdAt, range.start),
        lte(orders.createdAt, range.end),
      ),
    )
    .orderBy(orders.createdAt);

  const orderIds = ordersRows.map((row) => row.id).filter(Boolean);

  const payments = orderIds.length
    ? await db
        .select({
          orderId: orderPayments.orderId,
          amount: orderPayments.amount,
        })
        .from(orderPayments)
        .where(
          and(
            inArray(orderPayments.orderId, orderIds),
            sql`${orderPayments.status} <> 'ANULADO'`,
          ),
        )
    : [];

  const paidByOrder = new Map<string, number>();
  for (const pay of payments) {
    const id = pay.orderId ?? "";
    if (!id) continue;
    const current = paidByOrder.get(id) ?? 0;
    paidByOrder.set(id, current + Number(pay.amount ?? 0));
  }

  const advisorStats = new Map<
    string,
    { name: string; currency: string; count: number; paidTotal: number }
  >();

  for (const row of ordersRows) {
    const name = row.advisorName ?? "Sin asesor";
    const currency = String(row.currency ?? "COP").toUpperCase();
    const paid = paidByOrder.get(row.id) ?? 0;
    const key = `${name}__${currency}`;
    const existing = advisorStats.get(key) ?? {
      name,
      currency,
      count: 0,
      paidTotal: 0,
    };

    existing.count += 1;
    existing.paidTotal += paid;
    advisorStats.set(key, existing);
  }

  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "VIOMAR";
  const companyNit = process.env.NEXT_PUBLIC_COMPANY_NIT ?? "-";

  const pedidosRows = [
    ["Empresa", companyName],
    ["NIT", companyNit],
    ["Mes", `${range.year}/${String(range.month).padStart(2, "0")}`],
    [""],
    ["Pedidos"],
    ["Codigo", "Cliente", "Estado", "Moneda", "Total", "Recaudo", "Asesor", "Fecha"],
    ...ordersRows.map((row) => {
      const cur = String(row.currency ?? "COP").toUpperCase();
      const total = Number(row.total ?? 0) + Number(row.shippingFee ?? 0);

      return [
        row.orderCode,
        row.clientName ?? "-",
        row.status ?? "-",
        cur,
        formatMoney(total, cur),
        formatMoney(paidByOrder.get(row.id) ?? 0, cur),
        row.advisorName ?? "Sin asesor",
        row.createdAt ? formatDate(row.createdAt) : "-",
      ];
    }),
  ];

  const asesoresRows = [
    [""],
    ["Asesores"],
    ["Asesor", "Moneda", "Pedidos", "Recaudo"],
    ...Array.from(advisorStats.values())
      .sort((a, b) => b.count - a.count)
      .map((row) => [
        row.name,
        row.currency,
        row.count,
        formatMoney(row.paidTotal, row.currency),
      ]),
  ];

  const wb = XLSX.utils.book_new();
  const pedidosSheet = aoaSheet([...pedidosRows, ...asesoresRows]);
  XLSX.utils.book_append_sheet(wb, pedidosSheet, "Pedidos");

  const filename = `pedidos-${range.year}-${String(range.month).padStart(2, "0")}.xlsx`;

  return workbookToXlsxResponse(wb, filename);
}
