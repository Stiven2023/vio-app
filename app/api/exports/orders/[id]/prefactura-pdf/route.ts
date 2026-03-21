import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { eq, sql } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { db } from "@/src/db";
import {
  clients,
  employees,
  orderItems,
  orderPayments,
  orders,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
} from "@/src/utils/auth-middleware";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function asNumber(value: unknown) {
  const n = Number(String(value ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

function roundMoney(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const d = new Date(String(value));

  if (Number.isNaN(d.getTime())) return "-";

  return new Intl.DateTimeFormat("es-CO").format(d);
}

function formatMoney(value: unknown, currency: string) {
  const cur = currency === "USD" ? "USD" : "COP";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: cur === "USD" ? 2 : 0,
    maximumFractionDigits: cur === "USD" ? 2 : 0,
  }).format(asNumber(value));
}

function sanitizeWinAnsi(value: unknown) {
  return String(value ?? "").replace(/[^\u0020-\u00FF]/g, "-");
}

function truncateText(value: unknown, max = 40) {
  const text = String(value ?? "-");

  if (text.length <= max) return text;

  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

async function readImageSourceBytes(
  source: string,
): Promise<Uint8Array | null> {
  const value = String(source ?? "").trim();

  if (!value) return null;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    const response = await fetch(value);

    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();

    return new Uint8Array(buffer);
  }

  const normalized = value.startsWith("/") ? value.slice(1) : value;
  const diskPath = join(process.cwd(), "public", normalized);
  const bytes = await readFile(diskPath);

  return new Uint8Array(bytes);
}

async function embedImageFromSource(
  pdf: PDFDocument,
  source: string,
): Promise<Awaited<ReturnType<PDFDocument["embedPng"]>> | null> {
  const bytes = await readImageSourceBytes(source);

  if (!bytes) return null;

  try {
    return await pdf.embedPng(bytes);
  } catch {
    try {
      return await pdf.embedJpg(bytes);
    } catch {
      return null;
    }
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "exports:prefactura:pdf",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const orderId = String(id ?? "").trim();

  if (!orderId) return new Response("id required", { status: 400 });

  const [header] = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      createdBy: orders.createdBy,
      clientName: clients.name,
      clientNit: clients.identification,
      type: orders.type,
      status: orders.status,
      currency: orders.currency,
      discount: orders.discount,
      shippingFee: (orders as any).shippingFee,
      createdAt: orders.createdAt,
      sellerName: employees.name,
      sellerSignatureImageUrl: employees.signatureImageUrl,
      sellerCompanyImageUrl: employees.companyImageUrl,
    })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .leftJoin(employees, eq(orders.createdBy, employees.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!header) return new Response("Not found", { status: 404 });

  const role = getRoleFromRequest(request);
  const employeeId = getEmployeeIdFromRequest(request);

  if (role === "ASESOR" && (!employeeId || header.createdBy !== employeeId)) {
    return new Response("Forbidden", { status: 403 });
  }

  const lines = await db
    .select({
      id: orderItems.id,
      name: orderItems.name,
      garmentType: orderItems.garmentType,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
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

  const rawSubtotal = lines.reduce((acc, l) => {
    const qty = Number(l.quantity ?? 0);
    const unit = asNumber(l.unitPrice);

    return acc + unit * qty;
  }, 0);

  const subtotalRounded = roundMoney(subtotal);
  const rawSubtotalRounded = roundMoney(rawSubtotal);
  const discountAmount = roundMoney(
    Math.max(0, rawSubtotalRounded - subtotalRounded),
  );
  const discountPercent =
    rawSubtotalRounded > 0
      ? Math.min(100, Math.max(0, (discountAmount / rawSubtotalRounded) * 100))
      : 0;

  const shippingFee = roundMoney(Math.max(0, asNumber(header.shippingFee)));
  const grandTotal = roundMoney(subtotalRounded + shippingFee);

  const [paidRow] = await db
    .select({
      paidTotal: sql<string>`coalesce(sum(${orderPayments.amount}), 0)::text`,
    })
    .from(orderPayments)
    .where(
      sql`${orderPayments.orderId} = ${orderId} and ${orderPayments.status} = 'PAGADO'`,
    )
    .limit(1);

  const paidTotal = roundMoney(Math.max(0, asNumber(paidRow?.paidTotal)));
  const remaining = roundMoney(Math.max(0, grandTotal - paidTotal));

  const payments = await db
    .select({
      id: orderPayments.id,
      amount: orderPayments.amount,
      method: orderPayments.method,
      status: orderPayments.status,
      createdAt: orderPayments.createdAt,
    })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId));

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const headerImage =
    (await embedImageFromSource(
      pdf,
      String(header.sellerCompanyImageUrl ?? ""),
    )) || (await embedImageFromSource(pdf, "/image.png"));
  const footerSignatureImage = await embedImageFromSource(
    pdf,
    String(header.sellerSignatureImageUrl ?? ""),
  );

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 30;
  const contentWidth = pageWidth - margin * 2;
  const lineColor = rgb(0.84, 0.86, 0.9);
  const textColor = rgb(0.12, 0.12, 0.15);
  const mutedColor = rgb(0.4, 0.42, 0.48);
  const headerBg = rgb(0.94, 0.96, 0.99);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    size = 10,
    isBold = false,
    color = textColor,
  ) => {
    page.drawText(sanitizeWinAnsi(text), {
      x,
      y: yPos,
      size,
      font: isBold ? bold : font,
      color,
    });
  };

  const drawFooter = () => {
    if (footerSignatureImage) {
      const footerWidth = pageWidth;
      const ratio = footerWidth / footerSignatureImage.width;
      const signatureHeight = Math.max(56, footerSignatureImage.height * ratio);

      page.drawImage(footerSignatureImage, {
        x: 0,
        y: 0,
        width: footerWidth,
        height: signatureHeight,
      });
    }

    drawText(
      "Documento generado automáticamente por Viomar",
      margin,
      10,
      8,
      false,
      mutedColor,
    );
  };

  if (headerImage) {
    const logoWidth = Math.min(280, contentWidth);
    const ratio = logoWidth / headerImage.width;
    const logoHeight = Math.max(60, headerImage.height * ratio);
    const logoX = (pageWidth - logoWidth) / 2;

    page.drawImage(headerImage, {
      x: logoX,
      y: y - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });

    y -= logoHeight + 12;
  }

  drawText(
    `PREFACTURA ${String(header.orderCode ?? "-")}`,
    margin,
    y,
    14,
    true,
  );
  y -= 20;

  const isPresentValue = (value: unknown) => {
    const text = String(value ?? "").trim();

    return text.length > 0 && text !== "-";
  };

  const infoPairs: Array<{ label: string; value: string }> = [];
  const pushPair = (label: string, value: unknown) => {
    const safeValue = String(value ?? "").trim();

    if (!isPresentValue(safeValue)) return;
    infoPairs.push({ label, value: safeValue });
  };

  pushPair("Pedido", String(header.orderCode ?? "-"));
  pushPair("Fecha", formatDate(header.createdAt));
  pushPair("Estado", String(header.status ?? "-"));
  pushPair("Tipo", String(header.type ?? "-"));
  pushPair("Cliente", String(header.clientName ?? "-"));
  pushPair("NIT Cliente", String(header.clientNit ?? "-"));
  pushPair("Asesor", String(header.sellerName ?? "-"));
  pushPair("Moneda", String(header.currency ?? "COP"));

  const infoRows: Array<
    [{ label: string; value: string }, { label: string; value: string } | null]
  > = [];

  for (let index = 0; index < infoPairs.length; index += 2) {
    infoRows.push([infoPairs[index], infoPairs[index + 1] ?? null]);
  }

  const rowH = 24;
  const colW = contentWidth / 2;

  infoRows.forEach((row, idx) => {
    const top = y - idx * rowH;

    page.drawRectangle({
      x: margin,
      y: top - rowH,
      width: contentWidth,
      height: rowH,
      borderColor: lineColor,
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });

    const [leftPair, rightPair] = row;

    if (rightPair) {
      page.drawLine({
        start: { x: margin + colW, y: top },
        end: { x: margin + colW, y: top - rowH },
        color: lineColor,
        thickness: 1,
      });
    }

    drawText(leftPair.label, margin + 6, top - 9, 8, false, mutedColor);
    drawText(
      truncateText(leftPair.value, rightPair ? 28 : 70),
      margin + 6,
      top - 19,
      9,
      true,
    );

    if (rightPair) {
      drawText(
        rightPair.label,
        margin + colW + 6,
        top - 9,
        8,
        false,
        mutedColor,
      );
      drawText(
        truncateText(rightPair.value, 28),
        margin + colW + 6,
        top - 19,
        9,
        true,
      );
    }
  });

  y -= infoRows.length * rowH + 14;

  const columns = [
    { label: "Diseño", width: 190 },
    { label: "Tipo", width: 70 },
    { label: "Cant.", width: 55 },
    { label: "Unitario", width: 105 },
    { label: "Total", width: contentWidth - (190 + 70 + 55 + 105) },
  ] as const;

  const headerH = 22;
  const rowDataH = 18;

  page.drawRectangle({
    x: margin,
    y: y - headerH,
    width: contentWidth,
    height: headerH,
    color: headerBg,
    borderColor: lineColor,
    borderWidth: 1,
  });

  let x = margin;

  columns.forEach((col) => {
    drawText(col.label, x + 4, y - 14, 8.5, true);
    x += col.width;
    page.drawLine({
      start: { x, y },
      end: { x, y: y - headerH },
      color: lineColor,
      thickness: 1,
    });
  });

  y -= headerH;

  const currency = String(header.currency ?? "COP").toUpperCase();

  for (const line of lines) {
    page.drawRectangle({
      x: margin,
      y: y - rowDataH,
      width: contentWidth,
      height: rowDataH,
      borderColor: lineColor,
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });

    const qty = Number(line.quantity ?? 0);
    const unit = asNumber(line.unitPrice);
    const totalLine =
      line.totalPrice !== null && line.totalPrice !== undefined
        ? asNumber(line.totalPrice)
        : qty * unit;

    const values = [
      truncateText(line.name ?? "-", 34),
      String(line.garmentType ?? "JUGADOR"),
      String(qty),
      formatMoney(unit, currency),
      formatMoney(totalLine, currency),
    ];

    let colX = margin;

    values.forEach((value, idx) => {
      drawText(String(value), colX + 4, y - 12, 8.2, idx === 0);
      colX += columns[idx].width;
      page.drawLine({
        start: { x: colX, y },
        end: { x: colX, y: y - rowDataH },
        color: lineColor,
        thickness: 1,
      });
    });

    y -= rowDataH;

    if (y < 240) break;
  }

  y -= 12;
  drawText("Resumen financiero", margin, y, 10, true);
  y -= 16;

  const summary: Array<[string, string]> = [
    ["Subtotal", formatMoney(subtotalRounded, currency)],
    [
      "Descuento",
      `${discountPercent.toFixed(2)}% (${formatMoney(discountAmount, currency)})`,
    ],
    ["Flete", formatMoney(shippingFee, currency)],
    ["Total", formatMoney(grandTotal, currency)],
    ["Abonado", formatMoney(paidTotal, currency)],
    ["Saldo", formatMoney(remaining, currency)],
  ];

  for (const [label, value] of summary) {
    drawText(label, margin, y, 9, true);
    drawText(value, margin + 190, y, 9, false);
    y -= 14;
  }

  y -= 8;
  drawText("Historial de abonos", margin, y, 10, true);
  y -= 14;

  for (const payment of payments.slice(0, 8)) {
    const paymentLine = `${formatDate(payment.createdAt)} · ${String(payment.method ?? "-")} · ${String(payment.status ?? "-")} · ${formatMoney(payment.amount ?? 0, currency)}`;

    drawText(truncateText(paymentLine, 95), margin, y, 8.5, false);
    y -= 12;
    if (y < 120) break;
  }

  drawFooter();

  const pdfBytes = await pdf.save();
  const normalizedBytes = Uint8Array.from(pdfBytes);
  const body = new Blob([normalizedBytes.buffer], { type: "application/pdf" });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="prefactura-${String(header.orderCode ?? "pedido").toLowerCase()}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
