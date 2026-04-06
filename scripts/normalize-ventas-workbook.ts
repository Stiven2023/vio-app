import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  listWorkbookSheetNames,
  normalizeHeaderKey,
  normalizeOrderCode,
  normalizeText,
  parseAmount,
  parseExcelDate,
  pickFirstValue,
  readWorksheetRows,
  type WorksheetRow,
} from "@/src/imports/historical-excel/helpers";
import { rawVentaSchema, type RawVenta } from "@/src/imports/historical-excel/schemas";

type CliOptions = {
  file: string;
  outDir: string;
  base: string;
  sheet?: string;
  dryRun: boolean;
};

const VENTA_ALIASES = {
  orderCode: ["order_code_ref", "order_code", "pedido", "codigo_pedido", "pedido_ref"],
  total: ["total", "valor_total", "monto_total", "venta_total", "valor_pedido", "debe"],
  subtotal: ["subtotal", "base", "valor_base"],
  paidAt: ["paid_at", "fecha_pago", "fecha_pagado", "paidat", "fecha_entrega"],
  paymentStatus: ["payment_status", "estado_pago", "pago_estado", "paymentstatus", "cancelado", "pago"],
  clientName: ["client_name", "cliente", "nombre_cliente", "razon_social"],
  invoiceNumber: ["invoice_number", "factura", "numero_factura", "nro_factura"],
} as const;

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    file: "data/imports/VENTAS.xlsx",
    outDir: "data/imports/normalized",
    base: "datos_ventas_normalizada",
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--file") {
      options.file = argv[index + 1] ?? options.file;
      index += 1;
      continue;
    }

    if (arg === "--out-dir") {
      options.outDir = argv[index + 1] ?? options.outDir;
      index += 1;
      continue;
    }

    if (arg === "--base") {
      options.base = argv[index + 1] ?? options.base;
      index += 1;
      continue;
    }

    if (arg === "--sheet") {
      options.sheet = argv[index + 1] ?? options.sheet;
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function inferSheetName(filePath: string, sheet?: string) {
  const sheetNames = listWorkbookSheetNames(filePath);
  const selectedSheet =
    sheet ??
    sheetNames.find((value) => /^ventas$/i.test(value)) ??
    sheetNames.find((value) => /venta|sales|pedido/i.test(value)) ??
    sheetNames[0];

  if (!selectedSheet) {
    throw new Error(`No se encontraron hojas en ${filePath}.`);
  }

  return { selectedSheet, sheetNames };
}

function normalizeVentaRow(row: WorksheetRow): RawVenta | null {
  const orderCode = normalizeOrderCode(
    String(pickFirstValue(row, VENTA_ALIASES.orderCode) ?? ""),
  );

  if (!orderCode) {
    return null;
  }

  const payload = {
    order_code_ref: orderCode,
    total: parseAmount(pickFirstValue(row, VENTA_ALIASES.total)),
    subtotal: parseAmount(pickFirstValue(row, VENTA_ALIASES.subtotal)),
    paid_at: parseExcelDate(pickFirstValue(row, VENTA_ALIASES.paidAt)),
    payment_status: normalizeText(pickFirstValue(row, VENTA_ALIASES.paymentStatus)) || null,
    client_name: normalizeText(pickFirstValue(row, VENTA_ALIASES.clientName)) || null,
    invoice_number: normalizeText(pickFirstValue(row, VENTA_ALIASES.invoiceNumber)) || null,
  };

  return rawVentaSchema.parse(payload);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const { selectedSheet, sheetNames } = inferSheetName(options.file, options.sheet);
  const rows = readWorksheetRows(options.file, selectedSheet);
  const ventas = rows
    .map((row) => normalizeVentaRow(row))
    .filter((row): row is RawVenta => row !== null);

  const summary = {
    mode: options.dryRun ? "DRY_RUN" : "APPLY",
    file: path.resolve(options.file),
    sheets: sheetNames,
    selectedSheet,
    ventas: ventas.length,
    skipped: rows.length - ventas.length,
    detectedHeaders: rows[0] ? Object.keys(rows[0]).map((value) => normalizeHeaderKey(value)) : [],
  };

  if (!options.dryRun) {
    await mkdir(options.outDir, { recursive: true });
    await writeFile(
      path.join(options.outDir, `${options.base}.ventas.json`),
      JSON.stringify(ventas, null, 2),
      "utf8",
    );
  }

  console.log(JSON.stringify(summary, null, 2));
}

void main();