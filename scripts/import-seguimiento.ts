import "dotenv/config";

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { and, eq, inArray } from "drizzle-orm";

import { erpDb } from "../src/db/erp";
import { mesDb } from "../src/db/mes";
import {
  orderItemPackaging,
  orderItems,
  orders,
} from "../src/db/schema";
import { operativeDashboardLogs as mesOperativeDashboardLogs } from "../src/db/mes/schema";

type RawOrder = {
  id: string;
  order_code: string;
  created_at: string | null;
  delivery_date: string | null;
  kind: string | null;
  status: string | null;
  total: string | null;
  currency: string | null;
};

type RawOrderItem = {
  id: string;
  order_id_ref?: string;
  order_code_ref: string;
  diseno_numero: number;
  name: string | null;
  garment_type: string | null;
  fabric: string | null;
  gender: string | null;
  quantity: number;
  estimated_lead_days: number | null;
  status: string | null;
};

type RawPackaging = {
  id: string;
  order_item_id: string;
  size: string | null;
  quantity: number | null;
  mode: string | null;
};

type RawLog = {
  id: string;
  order_item_id: string;
  order_code: string;
  design_name: string;
  role_area: string | null;
  operation_type: string | null;
  process_code: string | null;
  size: string | null;
  quantity_op: number | null;
  produced_quantity: number | null;
  start_at: string | null;
  end_at: string | null;
  is_complete: boolean | null;
  is_partial: boolean | null;
  observations: string | null;
  repo_check: boolean | null;
};

type CliOptions = {
  dir: string;
  base: string;
  dryRun: boolean;
};

type MesLogReportRow = {
  logId: string;
  orderCode: string;
  orderItemLegacyId: string;
  orderItemDbId: string;
  status: "inserted" | "would_insert";
};

type MissingItemReportRow = {
  logId: string;
  orderCode: string;
  orderItemLegacyId: string;
  reason: string;
};

type OrderInsert = typeof orders.$inferInsert;
type OrderItemInsert = typeof orderItems.$inferInsert;

type OrderTypeValue = NonNullable<OrderInsert["type"]>;
type OrderStatusValue = NonNullable<OrderInsert["status"]>;
type OrderItemStatusValue = NonNullable<OrderItemInsert["status"]>;

const ORDER_TYPE_BY_PREFIX: Record<string, OrderTypeValue> = {
  VN: "VN",
  VI: "VI",
  VT: "VT",
  VW: "VW",
  VR: "VN",
  VP: "VN",
};

const ORDER_STATUS_MAP: Record<string, OrderStatusValue> = {
  DESPACHO: "ENTREGADO",
  EN_PRODUCCION: "PRODUCCION",
  AVAL: "APROBACION",
};

const ITEM_STATUS_MAP: Record<string, OrderItemStatusValue> = {
  DESPACHO: "ENVIADO",
  EN_PRODUCCION: "PENDIENTE_PRODUCCION",
  AVAL: "APROBACION",
};

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    dir: "D:/Programación/Vio",
    base: "datos_seguimiento_normalizada",
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

function normalizeOrderCode(value: string | null | undefined): string {
  const text = String(value ?? "").trim().toUpperCase();

  if (!text) {
    return "";
  }

  const match = text.match(/\b(VN|VT|VI|VW|VR|VP)\s*-?\s*(\d+)\b/);

  if (match) {
    return `${match[1]} - ${match[2]}`;
  }

  return text.replace(/\s+/g, " ");
}

function mapOrderType(orderCode: string): OrderTypeValue {
  const prefix = orderCode.split(" - ")[0]?.trim().toUpperCase() ?? "";
  return ORDER_TYPE_BY_PREFIX[prefix] ?? "VN";
}

function mapOrderStatus(rawStatus: string | null): OrderStatusValue {
  if (!rawStatus) {
    return "APROBACION";
  }

  return ORDER_STATUS_MAP[rawStatus] ?? "APROBACION";
}

function mapItemStatus(rawStatus: string | null): OrderItemStatusValue {
  if (!rawStatus) {
    return "PENDIENTE";
  }

  return ITEM_STATUS_MAP[rawStatus] ?? "PENDIENTE";
}

function toDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeName(value: string | null): string {
  const trimmed = (value ?? "").trim();
  return clampText(trimmed.length > 0 ? trimmed : "Diseño migrado", 255) ?? "Diseño migrado";
}

function clampText(value: string | null | undefined, max: number): string | undefined {
  const text = String(value ?? "").trim();

  if (!text) {
    return undefined;
  }

  return text.slice(0, max);
}

function makeItemKey(orderId: string, row: RawOrderItem): string {
  return [
    orderId,
    safeName(row.name).toUpperCase(),
    (row.garment_type ?? "").trim().toUpperCase(),
    (row.fabric ?? "").trim().toUpperCase(),
    String(row.diseno_numero ?? 0),
  ].join("|");
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));

  const ordersPath = path.join(options.dir, `${options.base}.orders.json`);
  const orderItemsPath = path.join(options.dir, `${options.base}.order_items.json`);
  const packagingPath = path.join(options.dir, `${options.base}.packaging.json`);
  const logsPath = path.join(options.dir, `${options.base}.logs.json`);

  const rawOrders = await readJsonFile<RawOrder[]>(ordersPath);
  const rawItems = await readJsonFile<RawOrderItem[]>(orderItemsPath);
  const rawPackaging = await readJsonFile<RawPackaging[]>(packagingPath);
  const rawLogs = await readJsonFile<RawLog[]>(logsPath);

  const orderCodes = [
    ...new Set(
      rawOrders
        .map((row) => normalizeOrderCode(row.order_code))
        .filter((code) => code.length > 0),
    ),
  ];

  const existingOrders =
    orderCodes.length === 0
      ? []
      : await erpDb
          .select({ id: orders.id, orderCode: orders.orderCode })
          .from(orders)
          .where(inArray(orders.orderCode, orderCodes));

  const orderIdByCode = new Map(existingOrders.map((row) => [row.orderCode, row.id]));
  const orderIdByLegacyId = new Map<string, string>();

  let insertedOrders = 0;
  let skippedOrders = 0;

  for (const row of rawOrders) {
    const normalizedOrderCode = normalizeOrderCode(row.order_code);
    const existingId = orderIdByCode.get(normalizedOrderCode);
    if (existingId) {
      orderIdByLegacyId.set(row.id, existingId);
      skippedOrders += 1;
      continue;
    }

    if (options.dryRun) {
      orderIdByCode.set(normalizedOrderCode, row.id);
      orderIdByLegacyId.set(row.id, row.id);
      insertedOrders += 1;
      continue;
    }

    await erpDb
      .insert(orders)
      .values({
        id: row.id,
        orderCode: normalizedOrderCode,
        type: mapOrderType(normalizedOrderCode),
        kind: row.kind === "COMPLETACION" || row.kind === "REFERENTE" ? row.kind : "NUEVO",
        status: mapOrderStatus(row.status),
        deliveryDate: row.delivery_date ?? undefined,
        total: row.total ?? "0",
        currency: row.currency ?? "COP",
        createdAt: toDate(row.created_at) ?? undefined,
      })
      .onConflictDoNothing({ target: orders.orderCode });

    orderIdByCode.set(normalizedOrderCode, row.id);
    orderIdByLegacyId.set(row.id, row.id);
    insertedOrders += 1;
  }

  const allOrderIds = [...orderIdByCode.values()];

  const existingItems =
    allOrderIds.length === 0
      ? []
      : await erpDb
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            name: orderItems.name,
            garmentType: orderItems.garmentType,
            fabric: orderItems.fabric,
          })
          .from(orderItems)
          .where(inArray(orderItems.orderId, allOrderIds));

  const itemIdByKey = new Map<string, string>();
  for (const row of existingItems) {
    if (!row.orderId) {
      continue;
    }

    const key = [
      row.orderId,
      (row.name ?? "").trim().toUpperCase(),
      (row.garmentType ?? "").trim().toUpperCase(),
      (row.fabric ?? "").trim().toUpperCase(),
      "0",
    ].join("|");

    itemIdByKey.set(key, row.id);
  }

  let insertedItems = 0;
  let skippedItems = 0;
  const legacyItemIdToDbId = new Map<string, string>();

  for (const row of rawItems) {
    const orderId =
      (row.order_id_ref ? orderIdByLegacyId.get(String(row.order_id_ref).trim()) : undefined) ??
      orderIdByCode.get(normalizeOrderCode(row.order_code_ref));
    if (!orderId) {
      skippedItems += 1;
      continue;
    }

    const specificKey = makeItemKey(orderId, row);
    const genericKey = [
      orderId,
      safeName(row.name).toUpperCase(),
      (row.garment_type ?? "").trim().toUpperCase(),
      (row.fabric ?? "").trim().toUpperCase(),
      "0",
    ].join("|");

    const existingId = itemIdByKey.get(specificKey) ?? itemIdByKey.get(genericKey);
    if (existingId) {
      legacyItemIdToDbId.set(row.id, existingId);
      skippedItems += 1;
      continue;
    }

    if (options.dryRun) {
      legacyItemIdToDbId.set(row.id, row.id);
      insertedItems += 1;
      continue;
    }

    await erpDb.insert(orderItems).values({
      id: row.id,
      orderId,
      name: safeName(row.name),
      garmentType: clampText(row.garment_type, 30),
      fabric: clampText(row.fabric, 100),
      gender: clampText(row.gender, 50),
      quantity: Math.max(0, Number(row.quantity ?? 0)),
      estimatedLeadDays: row.estimated_lead_days ?? undefined,
      status: mapItemStatus(row.status),
      isActive: true,
      hasAdditions: false,
      screenPrint: false,
      embroidery: false,
      buttonhole: false,
      snap: false,
      tag: false,
      flag: false,
    });

    itemIdByKey.set(specificKey, row.id);
    itemIdByKey.set(genericKey, row.id);
    legacyItemIdToDbId.set(row.id, row.id);
    insertedItems += 1;
  }

  let insertedPackaging = 0;
  let skippedPackaging = 0;

  for (const row of rawPackaging) {
    const dbItemId = legacyItemIdToDbId.get(row.order_item_id);
    if (!dbItemId) {
      skippedPackaging += 1;
      continue;
    }

    const alreadyExists = await erpDb
      .select({ id: orderItemPackaging.id })
      .from(orderItemPackaging)
      .where(
        and(
          eq(orderItemPackaging.orderItemId, dbItemId),
          eq(orderItemPackaging.size, row.size ?? "INDEFINIDA"),
          eq(orderItemPackaging.quantity, Math.max(0, Number(row.quantity ?? 0))),
        ),
      )
      .limit(1);

    if (alreadyExists.length > 0) {
      skippedPackaging += 1;
      continue;
    }

    if (options.dryRun) {
      insertedPackaging += 1;
      continue;
    }

    await erpDb.insert(orderItemPackaging).values({
      id: row.id,
      orderItemId: dbItemId,
      size: row.size ?? "INDEFINIDA",
      quantity: Math.max(0, Number(row.quantity ?? 0)),
      mode: row.mode ?? "AGRUPADO",
    });

    insertedPackaging += 1;
  }

  let insertedLogs = 0;
  let skippedLogs = 0;
  const mesLogsInsertedReport: MesLogReportRow[] = [];
  const mesLogsMissingItemReport: MissingItemReportRow[] = [];
  const orderCodesNotLinkedSet = new Set<string>();

  for (const row of rawLogs) {
    const normalizedLogOrderCode = normalizeOrderCode(row.order_code);
    const hasErpOrderLink = orderIdByCode.has(normalizedLogOrderCode);

    if (!hasErpOrderLink && normalizedLogOrderCode) {
      orderCodesNotLinkedSet.add(normalizedLogOrderCode);
    }

    const dbItemId = legacyItemIdToDbId.get(row.order_item_id);
    if (!dbItemId) {
      mesLogsMissingItemReport.push({
        logId: row.id,
        orderCode: normalizedLogOrderCode,
        orderItemLegacyId: row.order_item_id,
        reason: "order_item_id sin relación en ERP (no encontrado en order_items mapeados)",
      });
      skippedLogs += 1;
      continue;
    }

    const existingLog = await mesDb
      .select({ id: mesOperativeDashboardLogs.id })
      .from(mesOperativeDashboardLogs)
      .where(eq(mesOperativeDashboardLogs.id, row.id))
      .limit(1);

    if (existingLog.length > 0) {
      skippedLogs += 1;
      continue;
    }

    if (options.dryRun) {
      mesLogsInsertedReport.push({
        logId: row.id,
        orderCode: normalizedLogOrderCode,
        orderItemLegacyId: row.order_item_id,
        orderItemDbId: dbItemId,
        status: "would_insert",
      });
      insertedLogs += 1;
      continue;
    }

    await mesDb.insert(mesOperativeDashboardLogs).values({
      id: row.id,
      roleArea: row.role_area ?? "OPERARIOS",
      operationType: row.operation_type ?? undefined,
      processCode: (row.process_code ?? "P").slice(0, 1),
      orderId: orderIdByCode.get(normalizedLogOrderCode) ?? null,
      orderItemId: dbItemId,
      sourceLegacyOrderItemId: String(row.order_item_id ?? "").trim() || null,
      orderCode: normalizedLogOrderCode || row.order_code,
      designName: row.design_name,
      size: row.size ?? undefined,
      quantityOp: Math.max(0, Number(row.quantity_op ?? 0)),
      producedQuantity: Math.max(0, Number(row.produced_quantity ?? 0)),
      startAt: toDate(row.start_at) ?? undefined,
      endAt: toDate(row.end_at) ?? undefined,
      isComplete: Boolean(row.is_complete),
      isPartial: Boolean(row.is_partial),
      observations: row.observations ?? undefined,
      repoCheck: Boolean(row.repo_check),
    });

    mesLogsInsertedReport.push({
      logId: row.id,
      orderCode: normalizedLogOrderCode,
      orderItemLegacyId: row.order_item_id,
      orderItemDbId: dbItemId,
      status: "inserted",
    });

    insertedLogs += 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.dryRun ? "DRY_RUN" : "APPLY",
    summary: {
      orders: { inserted: insertedOrders, skipped: skippedOrders },
      orderItems: { inserted: insertedItems, skipped: skippedItems },
      orderItemPackaging: {
        inserted: insertedPackaging,
        skipped: skippedPackaging,
      },
      mesOperativeDashboardLogs: { inserted: insertedLogs, skipped: skippedLogs },
    },
    sections: {
      // 1) Logs de producción insertados (o a insertar) en MES
      logsMesInserted: mesLogsInsertedReport,
      // 2) Logs omitidos por item no encontrado
      logsSkippedByMissingItem: mesLogsMissingItemReport,
      // 3) Order codes no enlazados a ERP
      orderCodesNotLinkedToErp: [...orderCodesNotLinkedSet].sort(),
    },
  };

  const reportPath = path.join(
    options.dir,
    `${options.base}.seguimiento.conciliacion.json`,
  );

  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf-8");

  console.log(`mode=${options.dryRun ? "DRY_RUN" : "APPLY"}`);
  console.log(`orders: inserted=${insertedOrders}, skipped=${skippedOrders}`);
  console.log(`order_items: inserted=${insertedItems}, skipped=${skippedItems}`);
  console.log(`order_item_packaging: inserted=${insertedPackaging}, skipped=${skippedPackaging}`);
  console.log(`mes.operative_dashboard_logs: inserted=${insertedLogs}, skipped=${skippedLogs}`);
  console.log(`reporte: ${reportPath}`);
}

void main();
