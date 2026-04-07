import "dotenv/config";

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { inArray } from "drizzle-orm";

import { normalizeOrderCode, parseAmount } from "@/src/imports/historical-excel/helpers";

import { erpDb } from "../src/db/erp";
import { orders } from "../src/db/schema";

type CliOptions = {
  dir: string;
  ventasBase: string;
  outFile: string;
  dryRun: boolean;
};

type RawVenta = {
  order_code_ref: string;
  total?: string | number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  seller_name?: string | null;
  advance_amount?: string | number | null;
  payment_amount?: string | number | null;
  paid_at?: string | null;
};

type OrderStudy = {
  orderCode: string;
  orderId: string | null;
  sellerName: string | null;
  orderTotal: string;
  advanceTotal: string;
  abonoTotal: string;
  paidTotal: string;
  pendingBalance: string;
  paymentMethod: string | null;
  paymentStatus: string | null;
  accountingStudy: {
    salesRevenue4135: string;
    customerAdvances280505: string;
    treasury110505: string;
    banks111005: string;
    receivables130505: string;
  };
  notes: string[];
};

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    dir: "D:/Programación/Vio",
    ventasBase: "datos_ventas_normalizada",
    outFile: "reporte_estudio_contable_historico.json",
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dir") {
      options.dir = argv[index + 1] ?? options.dir;
      index += 1;
      continue;
    }

    if (arg === "--ventas-base") {
      options.ventasBase = argv[index + 1] ?? options.ventasBase;
      index += 1;
      continue;
    }

    if (arg === "--out-file") {
      options.outFile = argv[index + 1] ?? options.outFile;
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function hasVentasSource(dirPath: string, base: string) {
  return existsSync(path.join(dirPath, `${base}.ventas.json`));
}

function resolveInputDir(options: CliOptions) {
  if (hasVentasSource(options.dir, options.ventasBase)) {
    return options.dir;
  }

  const fallbackDir = "D:/Programación/Vio";
  if (fallbackDir !== options.dir && hasVentasSource(fallbackDir, options.ventasBase)) {
    return fallbackDir;
  }

  return options.dir;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

function toMoney(value: string | number | null | undefined) {
  if (value == null || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value).trim();
  if (!raw) {
    return 0;
  }

  const direct = Number(raw);
  const parsed = Number.isFinite(direct) ? direct : Number(parseAmount(raw) ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function normalizePaymentMethod(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized.includes("TRANS") || normalized.includes("BANCO") || normalized.includes("CONSIGN")) {
    return "TRANSFERENCIA";
  }
  if (normalized.includes("CRED")) {
    return "CREDITO";
  }
  return normalized ? "EFECTIVO" : null;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const sourceDir = resolveInputDir(options);
  const ventasPath = path.join(sourceDir, `${options.ventasBase}.ventas.json`);
  const ventas = await readJsonFile<RawVenta[]>(ventasPath);

  const orderCodes = [...new Set(ventas.map((row) => normalizeOrderCode(row.order_code_ref)).filter(Boolean))];

  const orderRows = orderCodes.length === 0
    ? []
    : await erpDb
        .select({ id: orders.id, orderCode: orders.orderCode })
        .from(orders)
        .where(inArray(orders.orderCode, orderCodes));
  const orderByCode = new Map(orderRows.map((row) => [row.orderCode, row.id]));

  const groupedByOrder = new Map<string, RawVenta[]>();
  for (const row of ventas) {
    const orderCode = normalizeOrderCode(row.order_code_ref);
    if (!orderCode) {
      continue;
    }
    groupedByOrder.set(orderCode, [...(groupedByOrder.get(orderCode) ?? []), row]);
  }

  const studies: OrderStudy[] = [];
  let totalSales = 0;
  let totalAdvances = 0;
  let totalAbonos = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let totalCash = 0;
  let totalBanks = 0;

  for (const [orderCode, rows] of groupedByOrder.entries()) {
    const first = rows[0] ?? null;
    const orderId = orderByCode.get(orderCode) ?? null;
    const orderTotal = Math.max(...rows.map((row) => toMoney(row.total)), 0);
    const advanceTotal = rows.reduce((sum, row) => sum + toMoney(row.advance_amount), 0);
    const abonoTotal = rows.reduce((sum, row) => sum + toMoney(row.payment_amount), 0);
    const normalizedMethod = normalizePaymentMethod(first?.payment_method);
    const paidTotal = advanceTotal + abonoTotal;
    const cashFromSource = normalizedMethod === "EFECTIVO" ? paidTotal : 0;
    const banksFromSource = normalizedMethod === "TRANSFERENCIA" ? paidTotal : 0;
    const pendingBalance = Math.max(orderTotal - paidTotal, 0);

    totalSales += orderTotal;
    totalAdvances += advanceTotal;
    totalAbonos += abonoTotal;
    totalPaid += paidTotal;
    totalPending += pendingBalance;
    totalCash += cashFromSource;
    totalBanks += banksFromSource;

    const notes: string[] = [];
    if (!orderId) {
      notes.push("Pedido no encontrado en ERP al momento del estudio.");
    }
    if (!rows.some((row) => toMoney(row.total) > 0)) {
      notes.push("La fuente histórica no trae total de venta útil para este pedido.");
    }
    notes.push("El estudio no calcula IVA ni retenciones porque la fuente histórica no trae base fiscal suficiente.");

    studies.push({
      orderCode,
      orderId,
      sellerName: first?.seller_name ?? null,
      orderTotal: formatMoney(orderTotal),
      advanceTotal: formatMoney(advanceTotal),
      abonoTotal: formatMoney(abonoTotal),
      paidTotal: formatMoney(paidTotal),
      pendingBalance: formatMoney(pendingBalance),
      paymentMethod: normalizePaymentMethod(first?.payment_method),
      paymentStatus: first?.payment_status ?? null,
      accountingStudy: {
        salesRevenue4135: formatMoney(orderTotal),
        customerAdvances280505: formatMoney(advanceTotal),
        treasury110505: formatMoney(cashFromSource),
        banks111005: formatMoney(banksFromSource),
        receivables130505: formatMoney(pendingBalance),
      },
      notes,
    });
  }

  studies.sort((a, b) => a.orderCode.localeCompare(b.orderCode));

  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.dryRun ? "DRY_RUN" : "APPLY",
    sourceDir,
    summary: {
      orders: studies.length,
      totalSales4135: formatMoney(totalSales),
      totalCustomerAdvances280505: formatMoney(totalAdvances),
      totalAbonos: formatMoney(totalAbonos),
      totalPaidTreasury: formatMoney(totalPaid),
      totalCash110505: formatMoney(totalCash),
      totalBanks111005: formatMoney(totalBanks),
      totalReceivables130505: formatMoney(totalPending),
    },
    assumptions: [
      "Ventas históricas se estudian con cuenta de ingresos 4135.",
      "Anticipos se estudian con cuenta 280505.",
      "Saldo pendiente se estudia con cuenta 130505.",
      "No se estiman IVA, retefuente ni reteICA por falta de columnas fiscales en la fuente histórica.",
    ],
    orders: studies,
  };

  const outPath = path.join(sourceDir, options.outFile);
  if (!options.dryRun) {
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(report, null, 2), "utf8");
  }

  console.log(`mode=${options.dryRun ? "DRY_RUN" : "APPLY"}`);
  console.log(`orders studied=${studies.length}`);
  console.log(`sales 4135=${formatMoney(totalSales)}`);
  console.log(`advances 280505=${formatMoney(totalAdvances)}`);
  console.log(`receivables 130505=${formatMoney(totalPending)}`);
  console.log(`cash 110505=${formatMoney(totalCash)}`);
  console.log(`banks 111005=${formatMoney(totalBanks)}`);
  console.log(`report=${outPath}`);
}

void main();