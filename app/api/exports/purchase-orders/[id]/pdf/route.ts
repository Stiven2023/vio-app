import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { db } from "@/src/db";
import { employees, purchaseOrderItems, purchaseOrders, suppliers } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function asNumber(value: unknown) {
  const parsed = Number(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(asNumber(value));
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CO").format(date);
}

function sanitizeWinAnsi(value: unknown) {
  return String(value ?? "").replace(/[^\u0020-\u00FF]/g, "-");
}

function truncateText(value: unknown, max = 48) {
  const text = String(value ?? "-").trim() || "-";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

async function readImageSourceBytes(source: string): Promise<Uint8Array | null> {
  const value = String(source ?? "").trim();
  if (!value) return null;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    const response = await fetch(value);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  }

  const normalized = value.startsWith("/") ? value.slice(1) : value;
  const diskPath = join(process.cwd(), "public", normalized);
  return new Uint8Array(await readFile(diskPath));
}

async function embedImageFromSource(pdf: PDFDocument, source: string) {
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
    key: "exports:purchase-order:pdf",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");
  if (forbidden) return forbidden;

  const { id } = await params;
  const orderId = String(id ?? "").trim();

  if (!orderId) return new Response("id required", { status: 400 });

  const [order] = await db
    .select({
      id: purchaseOrders.id,
      purchaseOrderCode: purchaseOrders.purchaseOrderCode,
      status: purchaseOrders.status,
      notes: purchaseOrders.notes,
      subtotal: purchaseOrders.subtotal,
      total: purchaseOrders.total,
      createdAt: purchaseOrders.createdAt,
      finalizedAt: purchaseOrders.finalizedAt,
      supplierName: suppliers.name,
      supplierCode: suppliers.supplierCode,
      supplierIdentification: suppliers.identification,
      supplierContactName: suppliers.contactName,
      supplierEmail: suppliers.email,
      supplierPhone: suppliers.fullMobile,
      supplierAddress: suppliers.address,
      supplierCity: suppliers.city,
      supplierDepartment: suppliers.department,
      createdByName: employees.name,
      companyImageUrl: employees.companyImageUrl,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .leftJoin(employees, eq(purchaseOrders.createdBy, employees.id))
    .where(eq(purchaseOrders.id, orderId))
    .limit(1);

  if (!order) return new Response("Not found", { status: 404 });

  const items = await db
    .select({
      id: purchaseOrderItems.id,
      itemCode: purchaseOrderItems.itemCode,
      itemName: purchaseOrderItems.itemName,
      unit: purchaseOrderItems.unit,
      quantity: purchaseOrderItems.quantity,
      unitPrice: purchaseOrderItems.unitPrice,
      lineTotal: purchaseOrderItems.lineTotal,
    })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo =
    (await embedImageFromSource(pdf, String(order.companyImageUrl ?? ""))) ||
    (await embedImageFromSource(pdf, "/image.png"));

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 32;
  const contentWidth = pageWidth - margin * 2;
  const lineColor = rgb(0.82, 0.84, 0.88);
  const textColor = rgb(0.14, 0.16, 0.2);
  const mutedColor = rgb(0.42, 0.45, 0.52);
  const accent = rgb(0.9, 0.55, 0.12);
  const paleAccent = rgb(0.99, 0.96, 0.92);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    size = 10,
    weight: "regular" | "bold" = "regular",
    color = textColor,
  ) => {
    page.drawText(sanitizeWinAnsi(text), {
      x,
      y: yPos,
      size,
      font: weight === "bold" ? bold : regular,
      color,
    });
  };

  const drawHeader = () => {
    let headerY = pageHeight - margin;

    if (logo) {
      const logoWidth = Math.min(220, contentWidth * 0.5);
      const logoHeight = (logo.height / logo.width) * logoWidth;
      page.drawImage(logo, {
        x: margin,
        y: headerY - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });
      headerY -= logoHeight + 10;
    }

    page.drawRectangle({
      x: margin,
      y: headerY - 54,
      width: contentWidth,
      height: 54,
      color: paleAccent,
      borderColor: accent,
      borderWidth: 1,
    });

    drawText("ORDEN DE COMPRA", margin + 16, headerY - 20, 18, "bold");
    drawText(String(order.purchaseOrderCode ?? "OC"), margin + 16, headerY - 38, 11, "bold", accent);
    drawText(`Fecha: ${formatDate(order.createdAt)}`, pageWidth - margin - 120, headerY - 20, 10);
    drawText(`Estado: ${String(order.status ?? "-")}`, pageWidth - margin - 120, headerY - 38, 10);

    y = headerY - 72;
  };

  const ensureSpace = (neededHeight: number) => {
    if (y - neededHeight > 86) return;
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    drawHeader();
  };

  const drawInfoBlock = (
    title: string,
    rows: Array<[string, string]>,
    x: number,
    width: number,
  ) => {
    const blockHeight = 26 + rows.length * 18 + 12;

    page.drawRectangle({
      x,
      y: y - blockHeight,
      width,
      height: blockHeight,
      color: rgb(1, 1, 1),
      borderColor: lineColor,
      borderWidth: 1,
    });

    drawText(title, x + 12, y - 18, 11, "bold");

    rows.forEach(([label, value], index) => {
      const rowY = y - 38 - index * 18;
      drawText(`${label}:`, x + 12, rowY, 9, "bold", mutedColor);
      drawText(value || "-", x + 94, rowY, 9);
    });
  };

  drawHeader();

  const leftWidth = (contentWidth - 12) / 2;
  const rightX = margin + leftWidth + 12;

  ensureSpace(150);

  drawInfoBlock(
    "Proveedor",
    [
      ["Proveedor", String(order.supplierName ?? "Sin proveedor")],
      ["Código", String(order.supplierCode ?? "-")],
      ["NIT / ID", String(order.supplierIdentification ?? "-")],
      ["Contacto", String(order.supplierContactName ?? "-")],
      ["Correo", String(order.supplierEmail ?? "-")],
      ["Teléfono", String(order.supplierPhone ?? "-")],
    ],
    margin,
    leftWidth,
  );

  drawInfoBlock(
    "Datos de orden",
    [
      ["Código", String(order.purchaseOrderCode ?? "-")],
      ["Fecha", formatDate(order.createdAt)],
      ["Elaboró", String(order.createdByName ?? "-")],
      ["Ciudad", `${String(order.supplierCity ?? "-")} / ${String(order.supplierDepartment ?? "-")}`],
      ["Dirección", truncateText(order.supplierAddress, 28)],
      ["Entrega", order.finalizedAt ? formatDate(order.finalizedAt) : "Pendiente"],
    ],
    rightX,
    leftWidth,
  );

  y -= 138;
  ensureSpace(220);

  page.drawRectangle({
    x: margin,
    y: y - 26,
    width: contentWidth,
    height: 26,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: lineColor,
    borderWidth: 1,
  });

  const columnX = {
    code: margin + 10,
    name: margin + 82,
    quantity: margin + 312,
    unitPrice: margin + 390,
    total: margin + 486,
  };

  drawText("Código", columnX.code, y - 16, 9, "bold");
  drawText("Producto", columnX.name, y - 16, 9, "bold");
  drawText("Cant.", columnX.quantity, y - 16, 9, "bold");
  drawText("Vr. unit", columnX.unitPrice, y - 16, 9, "bold");
  drawText("Subtotal", columnX.total, y - 16, 9, "bold");

  y -= 26;

  items.forEach((item) => {
    ensureSpace(30);

    page.drawRectangle({
      x: margin,
      y: y - 30,
      width: contentWidth,
      height: 30,
      color: rgb(1, 1, 1),
      borderColor: lineColor,
      borderWidth: 1,
    });

    drawText(String(item.itemCode ?? "-"), columnX.code, y - 18, 8);
    drawText(`${truncateText(item.itemName, 34)} (${String(item.unit ?? "und")})`, columnX.name, y - 18, 8);
    drawText(String(item.quantity ?? "0"), columnX.quantity, y - 18, 8);
    drawText(formatMoney(item.unitPrice), columnX.unitPrice, y - 18, 8);
    drawText(formatMoney(item.lineTotal), columnX.total, y - 18, 8);

    y -= 30;
  });

  ensureSpace(120);

  const totalsBoxWidth = 190;
  const totalsX = pageWidth - margin - totalsBoxWidth;

  page.drawRectangle({
    x: totalsX,
    y: y - 58,
    width: totalsBoxWidth,
    height: 58,
    color: paleAccent,
    borderColor: lineColor,
    borderWidth: 1,
  });

  drawText("Subtotal", totalsX + 12, y - 18, 10, "bold");
  drawText(formatMoney(order.subtotal), totalsX + 110, y - 18, 10, "bold");
  drawText("Total", totalsX + 12, y - 40, 11, "bold", accent);
  drawText(formatMoney(order.total), totalsX + 110, y - 40, 11, "bold", accent);

  if (String(order.notes ?? "").trim()) {
    ensureSpace(78);
    const notesY = y - 84;
    page.drawRectangle({
      x: margin,
      y: notesY,
      width: contentWidth,
      height: 50,
      color: rgb(1, 1, 1),
      borderColor: lineColor,
      borderWidth: 1,
    });
    drawText("Observaciones", margin + 12, notesY + 34, 10, "bold");
    drawText(truncateText(order.notes, 120), margin + 12, notesY + 16, 9);
    y = notesY - 18;
  } else {
    y -= 76;
  }

  ensureSpace(96);

  const signatureWidth = (contentWidth - 24) / 3;
  const signatureY = y - 48;
  const signatures = [
    `Elaboró${order.createdByName ? `: ${order.createdByName}` : ""}`,
    "Aprobó",
    "Recibió proveedor",
  ];

  signatures.forEach((label, index) => {
    const x = margin + index * (signatureWidth + 12);
    page.drawLine({
      start: { x, y: signatureY },
      end: { x: x + signatureWidth, y: signatureY },
      color: lineColor,
      thickness: 1,
    });
    drawText(label, x, signatureY - 14, 9, "bold", mutedColor);
  });

  const pdfBytes = await pdf.save();

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${String(order.purchaseOrderCode ?? "orden-compra")}.pdf"`,
    },
  });
}