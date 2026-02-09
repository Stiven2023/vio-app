import ExcelJS from "exceljs";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Buffer as NodeBuffer } from "node:buffer";

import { db } from "@/src/db";
import { clients, orderPayments, orders } from "@/src/db/schema";
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

  const resumenSheet = workbook.addWorksheet("Resumen");
  resumenSheet.pageSetup = {
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

  resumenSheet.getColumn(1).width = 22;
  resumenSheet.getColumn(2).width = 20;
  resumenSheet.getColumn(3).width = 14;

  resumenSheet.mergeCells(1, 1, 1, 3);
  resumenSheet.mergeCells(2, 1, 2, 3);
  const titleCell = resumenSheet.getCell(1, 1);
  titleCell.value = companyName;
  titleCell.font = { size: 18, bold: true };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  const subtitleCell = resumenSheet.getCell(2, 1);
  subtitleCell.value = "Reporte de Ventas";
  subtitleCell.font = { size: 11 };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left" };

  resumenSheet.getRow(1).height = 26;
  resumenSheet.getRow(2).height = 18;
  resumenSheet.getRow(3).height = 6;

  resumenSheet.getCell(4, 1).value = "NIT";
  resumenSheet.getCell(4, 1).font = { bold: true };
  resumenSheet.getCell(4, 2).value = companyNit;
  resumenSheet.getCell(4, 3).value = `${range.year}/${String(range.month).padStart(2, "0")}`;

  for (let col = 1; col <= 3; col += 1) {
    for (let row = 1; row <= 5; row += 1) {
      applyThinBorder(resumenSheet.getCell(row, col));
    }
  }

  if (stickerImageId) {
    resumenSheet.addImage(stickerImageId, {
      tl: { col: 1.8, row: 0.1 },
      ext: { width: 120, height: 60 },
    });
  }

  let rowPointer = 7;
  styleSectionTitle(resumenSheet, rowPointer, 1, 3, "TOTALES POR MONEDA");
  rowPointer += 1;
  resumenSheet.addRow(["Moneda", "Total cobrado", "Pagos"]);
  styleTableHeader(resumenSheet, rowPointer, 1, 3);
  rowPointer += 1;

  for (const [cur, total] of totalsByCurrency.entries()) {
    const row = resumenSheet.addRow([
      cur,
      formatMoney(total, cur),
      payments.filter((p) => String(p.currency ?? "COP").toUpperCase() === cur).length,
    ]);
    applyRowBorder(resumenSheet, row.number, 1, 3);
    centerRowCells(resumenSheet, row.number, 1, 3);
    rowPointer = row.number + 1;
  }

  const pagosSheet = workbook.addWorksheet("Pagos");
  pagosSheet.pageSetup = resumenSheet.pageSetup;
  pagosSheet.getColumn(1).width = 12;
  pagosSheet.getColumn(2).width = 14;
  pagosSheet.getColumn(3).width = 26;
  pagosSheet.getColumn(4).width = 10;
  pagosSheet.getColumn(5).width = 16;
  pagosSheet.getColumn(6).width = 16;

  pagosSheet.mergeCells(1, 1, 1, 6);
  pagosSheet.mergeCells(2, 1, 2, 6);
  pagosSheet.getCell(1, 1).value = companyName;
  pagosSheet.getCell(1, 1).font = { size: 18, bold: true };
  pagosSheet.getCell(2, 1).value = "Detalle de Pagos";
  pagosSheet.getCell(2, 1).font = { size: 11 };
  pagosSheet.getRow(1).height = 26;
  pagosSheet.getRow(2).height = 18;
  pagosSheet.getRow(3).height = 6;

  for (let col = 1; col <= 6; col += 1) {
    for (let row = 1; row <= 3; row += 1) {
      applyThinBorder(pagosSheet.getCell(row, col));
    }
  }

  if (stickerImageId) {
    pagosSheet.addImage(stickerImageId, {
      tl: { col: 3.6, row: 0.1 },
      ext: { width: 120, height: 60 },
    });
  }

  rowPointer = 5;
  styleSectionTitle(pagosSheet, rowPointer, 1, 6, "HISTORIAL DE PAGOS");
  rowPointer += 1;
  pagosSheet.addRow(["Fecha", "Pedido", "Cliente", "Moneda", "Metodo", "Monto"]);
  styleTableHeader(pagosSheet, rowPointer, 1, 6);
  rowPointer += 1;

  for (const p of payments) {
    const cur = String(p.currency ?? "COP").toUpperCase();
    const row = pagosSheet.addRow([
      p.createdAt ? formatDate(p.createdAt) : "-",
      p.orderCode ?? "-",
      p.clientName ?? "-",
      cur,
      p.method ?? "-",
      formatMoney(p.amount ?? 0, cur),
    ]);
    applyRowBorder(pagosSheet, row.number, 1, 6);
    centerRowCells(pagosSheet, row.number, 1, 6);
  }

  const filename = `ventas-${range.year}-${String(range.month).padStart(2, "0")}.xlsx`;

  return workbookToXlsxResponse(workbook, filename);
}
