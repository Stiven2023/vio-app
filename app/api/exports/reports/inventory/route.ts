import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Buffer as NodeBuffer } from "node:buffer";

import { db } from "@/src/db";
import { inventoryEntries, inventoryItems, inventoryOutputs } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { workbookToXlsxResponse } from "@/src/utils/exceljs-export";

type ImageExtension = "png" | "jpeg";

function imageBase64(buffer: NodeBuffer, extension: ImageExtension) {
  const mime = extension === "png" ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
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
    key: "exports:inventory",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "VIOMAR";
  const companyNit = process.env.NEXT_PUBLIC_COMPANY_NIT ?? "-";
  const today = new Date();

  const items = await db
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      unit: inventoryItems.unit,
      minStock: inventoryItems.minStock,
      entriesTotal: sql<string>`coalesce((select sum(${inventoryEntries.quantity}) from inventory_entries ie where ie.inventory_item_id = ${inventoryItems.id}), 0)::text`,
      outputsTotal: sql<string>`coalesce((select sum(${inventoryOutputs.quantity}) from inventory_outputs io where io.inventory_item_id = ${inventoryItems.id}), 0)::text`,
    })
    .from(inventoryItems)
    .orderBy(inventoryItems.name);

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

  const sheet = workbook.addWorksheet("Inventario");
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

  sheet.getColumn(1).width = 30;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 12;
  sheet.getColumn(4).width = 12;
  sheet.getColumn(5).width = 12;
  sheet.getColumn(6).width = 12;

  sheet.mergeCells(1, 1, 1, 6);
  sheet.mergeCells(2, 1, 2, 6);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = companyName;
  titleCell.font = { size: 18, bold: true };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = "Reporte de Inventario";
  subtitleCell.font = { size: 11 };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left" };

  sheet.getRow(1).height = 26;
  sheet.getRow(2).height = 18;
  sheet.getRow(3).height = 6;

  sheet.getCell(4, 1).value = "NIT";
  sheet.getCell(4, 1).font = { bold: true };
  sheet.getCell(4, 2).value = companyNit;
  sheet.getCell(4, 4).value = "Fecha";
  sheet.getCell(4, 4).font = { bold: true };
  sheet.getCell(4, 5).value = formatDate(today);

  for (let col = 1; col <= 6; col += 1) {
    for (let row = 1; row <= 5; row += 1) {
      applyThinBorder(sheet.getCell(row, col));
    }
  }

  if (stickerImageId) {
    sheet.addImage(stickerImageId, {
      tl: { col: 4.2, row: 0.1 },
      ext: { width: 120, height: 60 },
    });
  }

  let rowPointer = 7;
  styleSectionTitle(sheet, rowPointer, 1, 6, "INVENTARIO");
  rowPointer += 1;

  sheet.addRow(["Item", "Unidad", "Minimo", "Entradas", "Salidas", "Stock"]);
  styleTableHeader(sheet, rowPointer, 1, 6);
  rowPointer += 1;

  for (const item of items) {
    const entries = Number(item.entriesTotal ?? 0);
    const outputs = Number(item.outputsTotal ?? 0);
    const stock = entries - outputs;

    const row = sheet.addRow([
      item.name ?? "-",
      item.unit ?? "-",
      item.minStock ?? "0",
      entries,
      outputs,
      stock,
    ]);
    applyRowBorder(sheet, row.number, 1, 6);
    centerRowCells(sheet, row.number, 1, 6);
    rowPointer = row.number + 1;
  }

  return workbookToXlsxResponse(workbook, "inventario-actual.xlsx");
}
