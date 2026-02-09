import * as XLSX from "xlsx";
import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, orderItems, orderPayments, orders } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { aoaSheet, workbookToXlsxResponse } from "@/src/utils/xlsx-export";

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
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
  const n = asNumber(value);
  const cur = currency === "USD" ? "USD" : "COP";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: cur === "USD" ? 2 : 0,
    maximumFractionDigits: cur === "USD" ? 2 : 0,
  }).format(n);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "exports:prefactura:excel",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const orderId = String(id ?? "").trim();

  if (!orderId) return new Response("id required", { status: 400 });

  const [orderRow] = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      clientName: clients.name,
      clientNit: clients.identification,
      type: orders.type,
      status: orders.status,
      currency: orders.currency,
      discount: orders.discount,
      shippingFee: (orders as any).shippingFee,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderRow) return new Response("Not found", { status: 404 });

  const lines = await db
    .select({
      id: orderItems.id,
      name: orderItems.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
      imageUrl: orderItems.imageUrl,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const subtotal = lines.reduce((acc, l) => {
    const qty = Number(l.quantity ?? 0);
    const unit = asNumber(l.unitPrice);
    const lineTotal =
      l.totalPrice !== null && l.totalPrice !== undefined
        ? asNumber(l.totalPrice)
        : unit * qty;

    return acc + lineTotal;
  }, 0);

  const discountPercent = Math.min(
    100,
    Math.max(0, asNumber(orderRow.discount)),
  );
  const discountAmount = subtotal * (discountPercent / 100);
  const totalAfterDiscount = subtotal - discountAmount;
  const shippingFee = Math.max(0, asNumber(orderRow.shippingFee));
  const grandTotal = totalAfterDiscount + shippingFee;

  const [paidRow] = await db
    .select({
      paidTotal: sql<string>`coalesce(sum(${orderPayments.amount}), 0)::text`,
    })
    .from(orderPayments)
    .where(
      sql`${orderPayments.orderId} = ${orderId} and ${orderPayments.status} <> 'ANULADO'`,
    )
    .limit(1);

  const paidTotal = Math.max(0, asNumber(paidRow?.paidTotal));
  const remaining = Math.max(0, grandTotal - paidTotal);

  const wb = XLSX.utils.book_new();

  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "VIOMAR";
  const companyNit = process.env.NEXT_PUBLIC_COMPANY_NIT ?? "-";
  const currency = String(orderRow.currency ?? "COP").toUpperCase();

  const rows = [
    ["Empresa", companyName],
    ["NIT", companyNit],
    [""],
    ["Pedido", orderRow.orderCode],
    ["Cliente", orderRow.clientName ?? "-"],
    ["NIT Cliente", orderRow.clientNit ?? "-"],
    ["Tipo", orderRow.type ?? "-"],
    ["Estado", orderRow.status ?? "-"],
    ["Moneda", currency],
    ["Fecha", orderRow.createdAt ? formatDate(orderRow.createdAt) : "-"],
    [""],
    ["Diseno", "Cantidad", "Unitario", "Total", "Imagen URL"],
    ...lines.map((line) => [
      line.name ?? "-",
      line.quantity ?? 0,
      formatMoney(line.unitPrice ?? 0, currency),
      formatMoney(line.totalPrice ?? 0, currency),
      line.imageUrl ?? "",
    ]),
    [""],
    ["Subtotal", formatMoney(subtotal, currency)],
    ["Descuento %", discountPercent],
    ["Descuento", formatMoney(discountAmount, currency)],
    ["Flete", formatMoney(shippingFee, currency)],
    ["Total", formatMoney(grandTotal, currency)],
    ["Abonado", formatMoney(paidTotal, currency)],
    ["Saldo", formatMoney(remaining, currency)],
    [""],
    ["Abonos"],
    ["Fecha", "Metodo", "Estado", "Monto", "Soporte URL"],
  ];

  const payments = await db
    .select({
      id: orderPayments.id,
      amount: orderPayments.amount,
      method: orderPayments.method,
      status: orderPayments.status,
      proofImageUrl: orderPayments.proofImageUrl,
      createdAt: orderPayments.createdAt,
    })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId));

  rows.push(
    ...payments.map((p) => [
      p.createdAt ? formatDate(p.createdAt) : "-",
      p.method ?? "-",
      p.status ?? "-",
      formatMoney(p.amount ?? 0, currency),
      p.proofImageUrl ?? "",
    ]),
  );

  XLSX.utils.book_append_sheet(wb, aoaSheet(rows), "Prefactura");

  const filename = `prefactura-${orderRow.orderCode}.xlsx`;

  return workbookToXlsxResponse(wb, filename);
}
