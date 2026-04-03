import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { erpDb } from "../src/db/erp";
import { orders } from "../src/db/schema";

type CliOptions = {
  dir: string;
  base: string;
  dryRun: boolean;
};

type RawVenta = {
  order_code_ref: string;
  total: string | number | null;
  subtotal: string | number | null;
  paid_at: string | null;
  payment_status: string | null;
  client_name: string | null;
  invoice_number: string | null;
};

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    dir: "D:/Programación/Vio",
    base: "datos_ventas_normalizada",
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--dir") {
      options.dir = argv[i + 1] ?? options.dir;
      i += 1;
      continue;
    }

    if (arg === "--base") {
      options.base = argv[i + 1] ?? options.base;
      i += 1;
    }
  }

  return options;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
}

function parseAmount(value: string | number | null): string | null {
  if (value == null) {
    return null;
  }

  const raw = String(value).trim();
  if (raw.length === 0) {
    return null;
  }

  const normalized = raw.replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.-]/g, "");
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return amount.toFixed(2);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));

  const ventasPath = path.join(options.dir, `${options.base}.ventas.json`);
  const rows = await readJsonFile<RawVenta[]>(ventasPath);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const orderCode = (row.order_code_ref ?? "").trim();
    if (!orderCode) {
      skipped += 1;
      continue;
    }

    const total = parseAmount(row.total);
    if (!total) {
      skipped += 1;
      continue;
    }

    const exists = await erpDb
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderCode, orderCode))
      .limit(1);

    if (exists.length === 0) {
      skipped += 1;
      continue;
    }

    if (options.dryRun) {
      updated += 1;
      continue;
    }

    await erpDb
      .update(orders)
      .set({ total })
      .where(eq(orders.orderCode, orderCode));

    updated += 1;
  }

  console.log(`mode=${options.dryRun ? "DRY_RUN" : "APPLY"}`);
  console.log(`orders updated from ventas=${updated}`);
  console.log(`rows skipped=${skipped}`);
}

void main();
