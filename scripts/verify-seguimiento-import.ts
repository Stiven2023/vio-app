import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { inArray } from "drizzle-orm";

import { erpDb } from "../src/db/erp";
import { mesDb } from "../src/db/mes";
import {
  operativeDashboardLogs as mesOperativeDashboardLogs,
} from "../src/db/mes/schema";
import {
  orderItemPackaging,
  orderItems,
  orders,
} from "../src/db/schema";

type CliOptions = {
  dir: string;
  base: string;
};

type WithId = {
  id: string;
};

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    dir: "C:/Users/Stiven.Aguirre/Documents",
    base: "datos_seguimiento_normalizada",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dir") {
      options.dir = argv[index + 1] ?? options.dir;
      index += 1;
      continue;
    }

    if (arg === "--base") {
      options.base = argv[index + 1] ?? options.base;
      index += 1;
    }
  }

  return options;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");

  return JSON.parse(content) as T;
}

function chunk<T>(items: T[], size: number): T[][] {
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
  const basePath = options.dir;

  const ordersPath = path.join(basePath, `${options.base}.orders.json`);
  const itemsPath = path.join(basePath, `${options.base}.order_items.json`);
  const packagingPath = path.join(basePath, `${options.base}.packaging.json`);
  const logsPath = path.join(basePath, `${options.base}.logs.json`);

  const sourceOrders = await readJsonFile<WithId[]>(ordersPath);
  const sourceItems = await readJsonFile<WithId[]>(itemsPath);
  const sourcePackaging = await readJsonFile<WithId[]>(packagingPath);
  const sourceLogs = await readJsonFile<WithId[]>(logsPath);

  const orderIds = sourceOrders.map((row) => row.id);
  const itemIds = sourceItems.map((row) => row.id);
  const packagingIds = sourcePackaging.map((row) => row.id);
  const logIds = sourceLogs.map((row) => row.id);

  const ordersFound = await countExistingIds(orderIds, async (batch) =>
    erpDb
      .select({ id: orders.id })
      .from(orders)
      .where(inArray(orders.id, batch)),
  );

  const itemsFound = await countExistingIds(itemIds, async (batch) =>
    erpDb
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(inArray(orderItems.id, batch)),
  );

  const packagingFound = await countExistingIds(packagingIds, async (batch) =>
    erpDb
      .select({ id: orderItemPackaging.id })
      .from(orderItemPackaging)
      .where(inArray(orderItemPackaging.id, batch)),
  );

  const mesLogsFound = await countExistingIds(logIds, async (batch) =>
    mesDb
      .select({ id: mesOperativeDashboardLogs.id })
      .from(mesOperativeDashboardLogs)
      .where(inArray(mesOperativeDashboardLogs.id, batch)),
  );

  console.log(
    JSON.stringify(
      {
        source: {
          orders: orderIds.length,
          orderItems: itemIds.length,
          orderItemPackaging: packagingIds.length,
          mesOperativeDashboardLogs: logIds.length,
        },
        db: {
          erp: {
            orders: ordersFound,
            orderItems: itemsFound,
            orderItemPackaging: packagingFound,
          },
          mes: {
            operativeDashboardLogs: mesLogsFound,
          },
        },
        missing: {
          orders: orderIds.length - ordersFound,
          orderItems: itemIds.length - itemsFound,
          orderItemPackaging: packagingIds.length - packagingFound,
          mesOperativeDashboardLogs: logIds.length - mesLogsFound,
        },
      },
      null,
      2,
    ),
  );
}

void main();