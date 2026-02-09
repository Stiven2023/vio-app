import * as XLSX from "xlsx";
import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { inventoryEntries, inventoryItems, inventoryOutputs } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { aoaSheet, workbookToXlsxResponse } from "@/src/utils/xlsx-export";

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
  const dateLabel = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

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

  const rows = [
    ["Empresa", companyName],
    ["NIT", companyNit],
    ["Fecha", dateLabel],
    [""],
    ["Inventario"],
    ["Item", "Unidad", "Minimo", "Entradas", "Salidas", "Stock"],
    ...items.map((item) => {
      const entries = Number(item.entriesTotal ?? 0);
      const outputs = Number(item.outputsTotal ?? 0);
      const stock = entries - outputs;

      return [
        item.name ?? "-",
        item.unit ?? "-",
        item.minStock ?? "0",
        entries,
        outputs,
        stock,
      ];
    }),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, aoaSheet(rows), "Inventario");

  return workbookToXlsxResponse(wb, "inventario-actual.xlsx");
}
