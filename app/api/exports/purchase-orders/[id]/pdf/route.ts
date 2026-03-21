import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { eq, inArray } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { db } from "@/src/db";
import {
  employees,
  inventoryItemVariants,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
} from "@/src/db/schema";
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

async function readImageSourceBytes(
  source: string,
): Promise<Uint8Array | null> {
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

// ── Datos de la empresa emisora ────────────────────────────────────────────
const COMPANY_INFO = {
  name: "VIOMAR SOLUCIONES SAS",
  nit: "901.113.329-1",
  address: "CR 42 54 A 71 BG 149",
  phone: "(57) 3003283971",
  city: "Itagui - Colombia",
};

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
      variantId: purchaseOrderItems.variantId,
    })
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

  const variantIds = items.map((i) => i.variantId).filter(Boolean) as string[];
  const variantMap = new Map<string, string>();

  if (variantIds.length > 0) {
    const variantRows = await db
      .select({
        id: inventoryItemVariants.id,
        color: inventoryItemVariants.color,
        size: inventoryItemVariants.size,
        sku: inventoryItemVariants.sku,
      })
      .from(inventoryItemVariants)
      .where(inArray(inventoryItemVariants.id, variantIds));

    for (const v of variantRows) {
      const label = [v.color, v.size].filter(Boolean).join(" / ") || v.sku;

      variantMap.set(v.id, label);
    }
  }

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
  const accent = rgb(0, 0.831, 0.667); // #00D4AA teal
  const paleAccent = rgb(0.88, 0.99, 0.97); // pale teal

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
    const headerY = pageHeight - margin;
    const halfW = (contentWidth - 12) / 2;
    const rightX = margin + halfW + 12;

    // ── Bloque izquierdo: logo + datos empresa ───────────────────────────────
    let leftY = headerY;

    if (logo) {
      const logoWidth = Math.min(160, halfW * 0.75);
      const logoHeight = (logo.height / logo.width) * logoWidth;

      page.drawImage(logo, {
        x: margin,
        y: leftY - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });
      leftY -= logoHeight + 8;
    }
    drawText(COMPANY_INFO.name, margin, leftY - 11, 10, "bold");
    drawText(
      `Nit ${COMPANY_INFO.nit}`,
      margin,
      leftY - 23,
      8,
      "regular",
      mutedColor,
    );
    drawText(
      COMPANY_INFO.address,
      margin,
      leftY - 35,
      8,
      "regular",
      mutedColor,
    );
    drawText(
      `Tel: ${COMPANY_INFO.phone}`,
      margin,
      leftY - 47,
      8,
      "regular",
      accent,
    );
    drawText(COMPANY_INFO.city, margin, leftY - 59, 8, "regular", accent);

    // ── Bloque derecho: título orden ─────────────────────────────────────────
    drawText("Orden de compra", rightX, headerY - 16, 16, "bold");
    drawText(
      `No. ${String(order.purchaseOrderCode ?? "OC")}`,
      rightX,
      headerY - 34,
      10,
      "regular",
      mutedColor,
    );

    // línea separadora horizontal
    const separatorY = Math.min(leftY - 72, headerY - 80);

    page.drawLine({
      start: { x: margin, y: separatorY },
      end: { x: pageWidth - margin, y: separatorY },
      color: lineColor,
      thickness: 1,
    });

    y = separatorY - 12;
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
      ["Para", String(order.supplierName ?? "Sin proveedor")],
      ["Nit", String(order.supplierIdentification ?? "-")],
      ["Fecha", formatDate(order.createdAt)],
      ["Elaboró", String(order.createdByName ?? "-")],
      ["Contacto", String(order.supplierContactName ?? "-")],
      ["Teléfono", String(order.supplierPhone ?? "-")],
    ],
    margin,
    leftWidth,
  );

  drawInfoBlock(
    "Datos de orden",
    [
      ["Código", String(order.purchaseOrderCode ?? "-")],
      ["Estado", String(order.status ?? "-")],
      [
        "Ciudad",
        `${String(order.supplierCity ?? "-")} / ${String(order.supplierDepartment ?? "-")}`,
      ],
      ["Dirección", truncateText(order.supplierAddress, 28)],
      ["Correo", String(order.supplierEmail ?? "-")],
      [
        "Entrega",
        order.finalizedAt ? formatDate(order.finalizedAt) : "Pendiente",
      ],
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
    const variantLabel = item.variantId
      ? (variantMap.get(item.variantId) ?? null)
      : null;
    const rowHeight = variantLabel ? 42 : 30;

    ensureSpace(rowHeight);

    page.drawRectangle({
      x: margin,
      y: y - rowHeight,
      width: contentWidth,
      height: rowHeight,
      color: rgb(1, 1, 1),
      borderColor: lineColor,
      borderWidth: 1,
    });

    const midY = variantLabel ? y - 13 : y - 18;

    drawText(String(item.itemCode ?? "-"), columnX.code, midY, 8);
    drawText(
      `${truncateText(item.itemName, 34)} (${String(item.unit ?? "und")})`,
      columnX.name,
      midY,
      8,
    );
    if (variantLabel) {
      drawText(variantLabel, columnX.name, y - 26, 7, "regular", mutedColor);
    }
    drawText(String(item.quantity ?? "0"), columnX.quantity, midY, 8);
    drawText(formatMoney(item.unitPrice), columnX.unitPrice, midY, 8);
    drawText(formatMoney(item.lineTotal), columnX.total, midY, 8);

    y -= rowHeight;
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
