import ExcelJS from "exceljs";
import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  additions,
  clients,
  employees,
  prefacturas,
  quotationItemAdditions,
  quotationItems,
  quotations,
  users,
} from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { workbookToXlsxResponse } from "@/src/utils/exceljs-export";

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

function applyThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
}

function applyRowBorder(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  fromCol: number,
  toCol: number,
) {
  for (let col = fromCol; col <= toCol; col += 1) {
    applyThinBorder(worksheet.getCell(rowNumber, col));
  }
}

function styleHeaderRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  fromCol: number,
  toCol: number,
) {
  const row = worksheet.getRow(rowNumber);
  row.font = { bold: true };
  for (let col = fromCol; col <= toCol; col += 1) {
    const cell = worksheet.getCell(rowNumber, col);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  }
  applyRowBorder(worksheet, rowNumber, fromCol, toCol);
}

function hasVisibleValue(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 0 && text !== "-";
}

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "quotations:export:excel",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "DESCARGAR_COTIZACION");
  if (forbidden) return forbidden;

  const quotationId = String(params.id ?? "").trim();
  if (!quotationId) return new Response("id required", { status: 400 });

  const [header] = await db
    .select({
      id: quotations.id,
      quoteCode: quotations.quoteCode,
      currency: quotations.currency,
      deliveryDate: quotations.deliveryDate,
      expiryDate: quotations.expiryDate,
      paymentTerms: quotations.paymentTerms,
      totalProducts: quotations.totalProducts,
      subtotal: quotations.subtotal,
      iva: quotations.iva,
      shippingFee: quotations.shippingFee,
      insuranceFee: quotations.insuranceFee,
      total: quotations.total,
      prefacturaCode: prefacturas.prefacturaCode,
      clientCode: clients.clientCode,
      clientName: clients.name,
      clientIdentification: clients.identification,
      sellerName: sql<string>`coalesce(${employees.name}, ${users.email})`,
      createdAt: quotations.createdAt,
    })
    .from(quotations)
    .leftJoin(clients, eq(quotations.clientId, clients.id))
    .leftJoin(users, eq(quotations.sellerId, users.id))
    .leftJoin(employees, eq(employees.userId, users.id))
    .leftJoin(prefacturas, eq(prefacturas.quotationId, quotations.id))
    .where(eq(quotations.id, quotationId))
    .limit(1);

  if (!header) return new Response("Cotización no encontrada", { status: 404 });

  const items = await db
    .select({
      id: quotationItems.id,
      orderType: quotationItems.orderType,
      negotiation: quotationItems.negotiation,
      quantity: quotationItems.quantity,
      unitPrice: quotationItems.unitPrice,
      discount: quotationItems.discount,
      orderCodeReference: quotationItems.orderCodeReference,
      designNumber: quotationItems.designNumber,
      productName: sql<string>`(
        select p.name from products p where p.id = ${quotationItems.productId}
      )`,
      productCode: sql<string>`(
        select p.product_code from products p where p.id = ${quotationItems.productId}
      )`,
    })
    .from(quotationItems)
    .where(eq(quotationItems.quotationId, quotationId));

  const itemIds = items.map((item) => item.id);

  const itemAdditions = itemIds.length
    ? await db
        .select({
          quotationItemId: quotationItemAdditions.quotationItemId,
          quantity: quotationItemAdditions.quantity,
          unitPrice: quotationItemAdditions.unitPrice,
          additionCode: additions.additionCode,
          additionName: additions.name,
        })
        .from(quotationItemAdditions)
        .leftJoin(additions, eq(quotationItemAdditions.additionId, additions.id))
        .where(inArray(quotationItemAdditions.quotationItemId, itemIds))
    : [];

  const additionsByItem = new Map<string, typeof itemAdditions>();
  for (const add of itemAdditions) {
    const key = String(add.quotationItemId);
    const current = additionsByItem.get(key) ?? [];
    current.push(add);
    additionsByItem.set(key, current);
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cotización");

  sheet.getColumn(1).width = 22;
  sheet.getColumn(2).width = 30;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 14;
  sheet.getColumn(5).width = 14;
  sheet.getColumn(6).width = 14;
  sheet.getColumn(7).width = 42;

  sheet.mergeCells(1, 1, 1, 7);
  sheet.getCell(1, 1).value = `COTIZACIÓN ${header.quoteCode ?? "-"}`;
  sheet.getCell(1, 1).font = { bold: true, size: 16 };
  sheet.getCell(1, 1).alignment = { vertical: "middle", horizontal: "left" };

  const infoPairs: Array<{ label: string; value: string }> = [];
  const pushPair = (label: string, value: unknown) => {
    const safe = String(value ?? "").trim();
    if (!hasVisibleValue(safe)) return;
    infoPairs.push({ label, value: safe });
  };

  pushPair("Cliente", header.clientName ?? "-");
  pushPair("Código", header.clientCode ?? "-");
  pushPair("NIT/ID", header.clientIdentification ?? "-");
  pushPair("Vendedor", header.sellerName ?? "-");
  pushPair("Moneda", header.currency ?? "COP");
  pushPair("Fecha", formatDate(header.createdAt));
  pushPair("Entrega", formatDate(header.deliveryDate));
  pushPair("Vence", formatDate(header.expiryDate));
  pushPair("Pago", header.paymentTerms ?? "-");
  pushPair("Prefactura", header.prefacturaCode ?? "-");

  const infoRows: Array<
    [{ label: string; value: string }, { label: string; value: string } | null]
  > = [];

  for (let index = 0; index < infoPairs.length; index += 2) {
    infoRows.push([infoPairs[index], infoPairs[index + 1] ?? null]);
  }

  let rowPointer = 3;
  for (const [leftPair, rightPair] of infoRows) {
    sheet.getCell(rowPointer, 1).value = leftPair.label;
    sheet.getCell(rowPointer, 1).font = { bold: true };

    if (rightPair) {
      sheet.mergeCells(rowPointer, 2, rowPointer, 3);
      sheet.getCell(rowPointer, 2).value = leftPair.value;
      sheet.getCell(rowPointer, 4).value = rightPair.label;
      sheet.getCell(rowPointer, 4).font = { bold: true };
      sheet.mergeCells(rowPointer, 5, rowPointer, 7);
      sheet.getCell(rowPointer, 5).value = rightPair.value;
    } else {
      sheet.mergeCells(rowPointer, 2, rowPointer, 7);
      sheet.getCell(rowPointer, 2).value = leftPair.value;
    }

    applyRowBorder(sheet, rowPointer, 1, 7);
    rowPointer += 1;
  }

  rowPointer += 1;
  sheet.mergeCells(rowPointer, 1, rowPointer, 7);
  sheet.getCell(rowPointer, 1).value = "DETALLE DE DISEÑOS";
  sheet.getCell(rowPointer, 1).font = { bold: true };
  applyRowBorder(sheet, rowPointer, 1, 7);
  rowPointer += 1;

  sheet.addRow(["Diseño", "Producto", "Tipo", "Cant.", "Unit.", "Total", "Adiciones"]);
  styleHeaderRow(sheet, rowPointer, 1, 7);
  rowPointer += 1;

  for (const item of items) {
    const additionsLabel = (additionsByItem.get(String(item.id)) ?? [])
      .map((add) => {
        const qty = asNumber(add.quantity);
        const unit = asNumber(add.unitPrice);
        return `${add.additionCode ?? "-"} ${add.additionName ?? ""} (${qty} x ${formatMoney(unit, String(header.currency ?? "COP"))})`;
      })
      .join("; ");

    const qty = asNumber(item.quantity);
    const unit = asNumber(item.unitPrice);
    const discount = asNumber(item.discount);
    const lineTotal = Math.max(0, qty * unit - discount);

    const row = sheet.addRow([
      item.designNumber ?? "-",
      `${item.productCode ?? "-"} ${item.productName ?? "-"}`,
      item.orderType ?? "-",
      qty,
      formatMoney(unit, String(header.currency ?? "COP")),
      formatMoney(lineTotal, String(header.currency ?? "COP")),
      additionsLabel || "-",
    ]);
    applyRowBorder(sheet, row.number, 1, 7);
  }

  rowPointer = sheet.lastRow ? sheet.lastRow.number + 2 : rowPointer + 2;
  sheet.mergeCells(rowPointer, 1, rowPointer, 7);
  sheet.getCell(rowPointer, 1).value = "LISTA DE EMPAQUE";
  sheet.getCell(rowPointer, 1).font = { bold: true };
  applyRowBorder(sheet, rowPointer, 1, 7);
  rowPointer += 1;

  sheet.addRow(["Número", "Nombre", "Talla", "Cantidad", "", "", ""]);
  styleHeaderRow(sheet, rowPointer, 1, 7);
  rowPointer += 1;

  const packagingNoteRow = sheet.addRow([
    "-",
    "Se define en el pedido/prefactura",
    "-",
    0,
    "",
    "",
    "",
  ]);
  applyRowBorder(sheet, packagingNoteRow.number, 1, 7);

  rowPointer = (sheet.lastRow ? sheet.lastRow.number : rowPointer) + 2;
  sheet.mergeCells(rowPointer, 1, rowPointer, 7);
  sheet.getCell(rowPointer, 1).value = "RESUMEN FINANCIERO";
  sheet.getCell(rowPointer, 1).font = { bold: true };
  applyRowBorder(sheet, rowPointer, 1, 7);
  rowPointer += 1;

  const moneyCurrency = String(header.currency ?? "COP").toUpperCase();
  const summaryRows: Array<[string, string]> = [
    ["Total productos", formatMoney(header.totalProducts ?? 0, moneyCurrency)],
    ["Subtotal", formatMoney(header.subtotal ?? 0, moneyCurrency)],
    ["IVA", formatMoney(header.iva ?? 0, moneyCurrency)],
    ["Flete", formatMoney(header.shippingFee ?? 0, moneyCurrency)],
    ["Seguro", formatMoney(header.insuranceFee ?? 0, moneyCurrency)],
    ["Total", formatMoney(header.total ?? 0, moneyCurrency)],
  ];

  for (const [label, value] of summaryRows) {
    sheet.getCell(rowPointer, 1).value = label;
    sheet.getCell(rowPointer, 1).font = { bold: true };
    sheet.mergeCells(rowPointer, 2, rowPointer, 7);
    sheet.getCell(rowPointer, 2).value = value;
    sheet.getCell(rowPointer, 2).alignment = { vertical: "middle", horizontal: "right" };
    applyRowBorder(sheet, rowPointer, 1, 7);
    rowPointer += 1;
  }

  const filename = `cotizacion-${header.quoteCode ?? quotationId}.xlsx`;
  return workbookToXlsxResponse(workbook, filename);
}
