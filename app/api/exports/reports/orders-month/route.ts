import ExcelJS from "exceljs";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Buffer as NodeBuffer } from "node:buffer";

import { db } from "@/src/db";
import { clients, employees, orderPayments, orders } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { workbookToXlsxResponse } from "@/src/utils/exceljs-export";

type ImageExtension = "png" | "jpeg";

function imageBase64(buffer: NodeBuffer, extension: ImageExtension) {
  const mime = extension === "png" ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

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

function styleSectionTitle(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  fromCol: number,
  toCol: number,
  title: string,
) {
  worksheet.mergeCells(rowNumber, fromCol, rowNumber, toCol);
  const cell = worksheet.getCell(rowNumber, fromCol);
  cell.value = title;
  cell.font = { bold: true };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  applyRowBorder(worksheet, rowNumber, fromCol, toCol);
}

function styleTableHeader(
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

function centerRowCells(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  fromCol: number,
  toCol: number,
) {
  for (let col = fromCol; col <= toCol; col += 1) {
    worksheet.getCell(rowNumber, col).alignment = {
      vertical: "middle",
      horizontal: "center",
    };
  }
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
    .where(and(gte(orders.createdAt, range.start), lte(orders.createdAt, range.end)))
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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = companyName;
  workbook.created = new Date();

  const stickerPath = path.join(process.cwd(), "public", "STICKER VIOMAR.png");
  const stickerBuffer = await readFile(stickerPath).catch(() => null);
  const stickerImageId = stickerBuffer
    ? workbook.addImage({
        base64: imageBase64(stickerBuffer as NodeBuffer, "png"),
        extension: "png",
      })
    : undefined;

  const sheet = workbook.addWorksheet("Pedidos");
  sheet.pageSetup = {
    orientation: "portrait",
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.7,
      right: 0.7,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3,
    },
  };

  sheet.getColumn(1).width = 12;
  sheet.getColumn(2).width = 22;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 10;
  sheet.getColumn(5).width = 16;
  sheet.getColumn(6).width = 16;
  sheet.getColumn(7).width = 20;
  sheet.getColumn(8).width = 12;

  sheet.mergeCells(1, 1, 1, 8);
  sheet.mergeCells(2, 1, 2, 8);
  sheet.getCell(1, 1).value = companyName;
  sheet.getCell(1, 1).font = { size: 18, bold: true };
  sheet.getCell(2, 1).value = "Reporte de Pedidos";
  sheet.getCell(2, 1).font = { size: 11 };
  sheet.getRow(1).height = 26;
  sheet.getRow(2).height = 18;
  sheet.getRow(3).height = 6;

  sheet.getCell(4, 1).value = "NIT";
  sheet.getCell(4, 1).font = { bold: true };
  sheet.getCell(4, 2).value = companyNit;
  sheet.getCell(4, 4).value = "Mes";
  sheet.getCell(4, 4).font = { bold: true };
  sheet.getCell(4, 5).value = `${range.year}/${String(range.month).padStart(2, "0")}`;

  for (let col = 1; col <= 8; col += 1) {
    for (let row = 1; row <= 5; row += 1) {
      applyThinBorder(sheet.getCell(row, col));
    }
  }

  if (stickerImageId) {
    sheet.addImage(stickerImageId, {
      tl: { col: 4.8, row: 0.1 },
      ext: { width: 120, height: 60 },
    });
  }

  let rowPointer = 7;
  styleSectionTitle(sheet, rowPointer, 1, 8, "PEDIDOS DEL MES");
  rowPointer += 1;

  sheet.addRow(["Codigo", "Cliente", "Estado", "Moneda", "Total", "Recaudo", "Asesor", "Fecha"]);
  styleTableHeader(sheet, rowPointer, 1, 8);
  rowPointer += 1;

  for (const rowItem of ordersRows) {
    const cur = String(rowItem.currency ?? "COP").toUpperCase();
    const total = Number(rowItem.total ?? 0) + Number(rowItem.shippingFee ?? 0);

    const row = sheet.addRow([
      rowItem.orderCode,
      rowItem.clientName ?? "-",
      rowItem.status ?? "-",
      cur,
      formatMoney(total, cur),
      formatMoney(paidByOrder.get(rowItem.id) ?? 0, cur),
      rowItem.advisorName ?? "Sin asesor",
      rowItem.createdAt ? formatDate(rowItem.createdAt) : "-",
    ]);
    applyRowBorder(sheet, row.number, 1, 8);
    centerRowCells(sheet, row.number, 1, 8);
    rowPointer = row.number + 1;
  }

  rowPointer += 1;
  styleSectionTitle(sheet, rowPointer, 1, 4, "ASESORES");
  rowPointer += 1;

  sheet.addRow(["Asesor", "Moneda", "Pedidos", "Recaudo"]);
  styleTableHeader(sheet, rowPointer, 1, 4);
  rowPointer += 1;

  for (const row of Array.from(advisorStats.values()).sort((a, b) => b.count - a.count)) {
    const line = sheet.addRow([
      row.name,
      row.currency,
      row.count,
      formatMoney(row.paidTotal, row.currency),
    ]);
    applyRowBorder(sheet, line.number, 1, 4);
    centerRowCells(sheet, line.number, 1, 4);
  }

  const filename = `pedidos-${range.year}-${String(range.month).padStart(2, "0")}.xlsx`;

  return workbookToXlsxResponse(workbook, filename);
}
