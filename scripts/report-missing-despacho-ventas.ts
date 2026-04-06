import "dotenv/config";

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { inArray } from "drizzle-orm";

import { erpDb } from "../src/db/erp";
import {
  buildMissingOrdersCsv,
  classifyMissingOrders,
} from "../src/imports/historical-excel/missing-orders";
import { orders } from "../src/db/schema";

type CliOptions = {
  dir: string;
  despachoBase: string;
  ventasBase: string;
};

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    dir: "C:/Users/Stiven.Aguirre/Documents",
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

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function fetchExistingOrderCodes(codes: string[]) {
  const existing = new Set<string>();

  for (let index = 0; index < codes.length; index += 500) {
    const batch = codes.slice(index, index + 500);
    const rows = await erpDb
      .select({ orderCode: orders.orderCode })
      .from(orders)
      .where(inArray(orders.orderCode, batch));

    for (const row of rows) {
      existing.add(String(row.orderCode));
    }
  }

  return existing;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));

  const enviosPath = path.join(options.dir, `${options.despachoBase}.envios.json`);
  const ventasPath = path.join(options.dir, `${options.ventasBase}.ventas.json`);

  const envios = await readJsonFile<Array<{ order_code_ref: string }>>(enviosPath);
  const ventas = await readJsonFile<Array<{ order_code_ref: string }>>(ventasPath);

  const despachoCodes = [
    ...new Set(
      envios.map((row) => String(row.order_code_ref ?? "").trim()).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const ventaCodes = [
    ...new Set(
      ventas.map((row) => String(row.order_code_ref ?? "").trim()).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const [despachoExisting, ventaExisting] = await Promise.all([
    fetchExistingOrderCodes(despachoCodes),
    fetchExistingOrderCodes(ventaCodes),
  ]);

  const despachoMissing = despachoCodes.filter((code) => !despachoExisting.has(code));
  const ventaMissing = ventaCodes.filter((code) => !ventaExisting.has(code));
  const consolidated = classifyMissingOrders({
    despacho: despachoMissing,
    ventas: ventaMissing,
  });

  const summary = {
    total: consolidated.length,
    invalidPrefix: consolidated.filter((entry) => !entry.isValidPrefix).length,
    sharedMissing: consolidated.filter((entry) => entry.classification === "shared_missing").length,
    singleFlowMissing: consolidated.filter((entry) => entry.classification === "single_flow_missing").length,
  };

  await writeFile(
    path.join(options.dir, "reporte_despacho_pedidos_no_cruzados.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: despachoMissing.length,
        orderCodes: despachoMissing,
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(options.dir, "reporte_ventas_pedidos_no_cruzados.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: ventaMissing.length,
        orderCodes: ventaMissing,
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(options.dir, "reporte_pedidos_no_cruzados_consolidado.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        summary,
        items: consolidated,
      },
      null,
      2,
    ),
    "utf8",
  );

  await writeFile(
    path.join(options.dir, "reporte_pedidos_no_cruzados_consolidado.csv"),
    buildMissingOrdersCsv(consolidated),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        despacho: {
          count: despachoMissing.length,
          sample: despachoMissing.slice(0, 20),
        },
        ventas: {
          count: ventaMissing.length,
          sample: ventaMissing.slice(0, 20),
        },
        consolidated: {
          summary,
          sample: consolidated.slice(0, 20),
        },
      },
      null,
      2,
    ),
  );
}

void main();