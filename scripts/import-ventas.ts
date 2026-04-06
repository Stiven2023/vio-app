import "dotenv/config";

import path from "node:path";

import { eq } from "drizzle-orm";

import {
  normalizeOrderCode,
  parseAmount,
} from "@/src/imports/historical-excel/helpers";
import { readJsonFile } from "@/src/imports/historical-excel/json";
import { rawVentaSchema, type RawVenta } from "@/src/imports/historical-excel/schemas";

import { erpDb } from "../src/db/erp";
import { orders } from "../src/db/schema";

type CliOptions = {
  dir: string;
  base: string;
  dryRun: boolean;
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

async function main() {
  const options = parseOptions(process.argv.slice(2));

  const ventasPath = path.join(options.dir, `${options.base}.ventas.json`);
  const sourceRows = await readJsonFile<unknown[]>(ventasPath);
  const rows = sourceRows
    .map((row) => rawVentaSchema.safeParse(row))
    .filter((result) => result.success)
    .map((result) => result.data);

  const invalidRows = sourceRows.length - rows.length;

  let updated = 0;
  let skipped = 0;
  let missingOrders = 0;

  for (const row of rows) {
    const orderCode = normalizeOrderCode(row.order_code_ref);
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
      missingOrders += 1;
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
  console.log(`invalid rows=${invalidRows}`);
  console.log(`orders updated from ventas=${updated}`);
  console.log(`rows skipped=${skipped}`);
  console.log(`missing orders=${missingOrders}`);
}

void main();
