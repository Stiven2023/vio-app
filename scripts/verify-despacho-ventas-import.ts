import "dotenv/config";

import { existsSync } from "node:fs";
import path from "node:path";

import { eq, inArray } from "drizzle-orm";

import { readJsonFile } from "@/src/imports/historical-excel/json";
import {
  type RawEnvio,
  type RawEnvioItem,
  type RawVenta,
} from "@/src/imports/historical-excel/schemas";

import { erpDb } from "../src/db/erp";
import { mesDb } from "../src/db/mes";
import { mesEnvioItems, mesEnvios } from "../src/db/mes/schema";
import { orders } from "../src/db/schema";

type CliOptions = {
  dir: string;
  despachoBase: string;
  ventasBase: string;
};

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    dir: "D:/Programación/Vio",
    despachoBase: "datos_despacho_normalizada",
    ventasBase: "datos_ventas_normalizada",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dir") {
      options.dir = argv[index + 1] ?? options.dir;
      index += 1;
      continue;
    }

    if (arg === "--despacho-base") {
      options.despachoBase = argv[index + 1] ?? options.despachoBase;
      index += 1;
      continue;
    }

    if (arg === "--ventas-base") {
      options.ventasBase = argv[index + 1] ?? options.ventasBase;
      index += 1;
    }
  }

  return options;
}

function hasVerifyLinkedSourceFiles(dirPath: string, options: CliOptions) {
  const requiredFiles = [
    `${options.despachoBase}.envios.json`,
    `${options.despachoBase}.envio_items.json`,
    `${options.ventasBase}.ventas.json`,
  ];

  return requiredFiles.every((fileName) => existsSync(path.join(dirPath, fileName)));
}

function resolveInputDir(options: CliOptions) {
  if (hasVerifyLinkedSourceFiles(options.dir, options)) {
    return options.dir;
  }

  const fallbackDir = "D:/Programación/Vio";
  if (fallbackDir !== options.dir && hasVerifyLinkedSourceFiles(fallbackDir, options)) {
    return fallbackDir;
  }

  return options.dir;
}

function chunk<T>(items: T[], size: number) {
  const output: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }

  return output;
}

async function countExistingIds(
  ids: string[],
  query: (batch: string[]) => Promise<Array<{ id: string }>>,
) {
  let total = 0;

  for (const batch of chunk(ids, 500)) {
    const rows = await query(batch);
    total += rows.length;
  }

  return total;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const sourceDir = resolveInputDir(options);

  const enviosPath = path.join(sourceDir, `${options.despachoBase}.envios.json`);
  const envioItemsPath = path.join(
    sourceDir,
    `${options.despachoBase}.envio_items.json`,
  );
  const ventasPath = path.join(sourceDir, `${options.ventasBase}.ventas.json`);

  const envios = await readJsonFile<RawEnvio[]>(enviosPath);
  const envioItems = await readJsonFile<RawEnvioItem[]>(envioItemsPath);
  const ventas = await readJsonFile<RawVenta[]>(ventasPath);

  const envioIds = envios.map((row) => row.id);
  const envioItemIds = envioItems.map((row) => row.id);
  const orderCodes = [...new Set(ventas.map((row) => row.order_code_ref))];

  const enviosFound = await countExistingIds(envioIds, async (batch) =>
    mesDb
      .select({ id: mesEnvios.id })
      .from(mesEnvios)
      .where(inArray(mesEnvios.id, batch)),
  );

  const envioItemsFound = await countExistingIds(envioItemIds, async (batch) =>
    mesDb
      .select({ id: mesEnvioItems.id })
      .from(mesEnvioItems)
      .where(inArray(mesEnvioItems.id, batch)),
  );

  let ordersFound = 0;
  for (const orderCode of orderCodes) {
    const rows = await erpDb
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderCode, orderCode))
      .limit(1);
    if (rows.length > 0) {
      ordersFound += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        source: {
          envios: envios.length,
          envioItems: envioItems.length,
          ventas: ventas.length,
          uniqueVentaOrders: orderCodes.length,
        },
        db: {
          mesEnvios: enviosFound,
          mesEnvioItems: envioItemsFound,
          ordersMatchedByVentas: ordersFound,
        },
        missing: {
          mesEnvios: envios.length - enviosFound,
          mesEnvioItems: envioItems.length - envioItemsFound,
          ordersMatchedByVentas: orderCodes.length - ordersFound,
        },
      },
      null,
      2,
    ),
  );
}

void main();