import "dotenv/config";

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { eq, inArray } from "drizzle-orm";

import {
  buildLinkedImportOrderId,
  buildLinkedImportOrderItemId,
  buildLinkedImportOrderItemName,
  hasValidLinkedImportPrefix,
  mapLinkedImportOrderType,
  resolveLinkedImportOrderStatus,
  shouldUpgradeImportedOrderToProduction,
} from "@/src/imports/historical-excel/linked-import";
import { normalizeOrderCode, normalizeText, parseAmount } from "@/src/imports/historical-excel/helpers";
import { readJsonFile } from "@/src/imports/historical-excel/json";
import {
  rawEnvioItemSchema,
  rawEnvioSchema,
  rawSeguimientoOrderItemSchema,
  rawSeguimientoOrderSchema,
  rawVentaSchema,
  type RawEnvio,
  type RawEnvioItem,
  type RawSeguimientoOrder,
  type RawSeguimientoOrderItem,
  type RawVenta,
} from "@/src/imports/historical-excel/schemas";

import { erpDb } from "../src/db/erp";
import { mesDb } from "../src/db/mes";
import { mesEnvioItems, mesEnvios } from "../src/db/mes/schema";
import { orderItems, orders } from "../src/db/schema";

type CliOptions = {
  dir: string;
  despachoBase: string;
  ventasBase: string;
  seguimientoBase: string;
  dryRun: boolean;
};

type DispatchItemAggregate = {
  orderCode: string;
  designNumber: number;
  quantity: number;
  packedQuantity: number;
};

type LinkedImportReportRow = {
  orderCode: string;
  action: "created" | "updated-status" | "reused" | "invalid-code";
  orderId: string | null;
  previousStatus: string | null;
  nextStatus: string | null;
  sources: string[];
};

const UUID_V4_OR_V1_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    dir: "C:/Users/Stiven.Aguirre/Documents",
    despachoBase: "datos_despacho_normalizada",
    ventasBase: "datos_ventas_normalizada",
    seguimientoBase: "datos_seguimiento_normalizada",
    dryRun: false,
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
      continue;
    }

    if (arg === "--seguimiento-base") {
      options.seguimientoBase = argv[index + 1] ?? options.seguimientoBase;
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function toDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isUuid(value: string | null | undefined) {
  return UUID_V4_OR_V1_RE.test(String(value ?? "").trim());
}

function mapDispatchArea(raw: string | null): "VIOMAR" | "INTEGRACION" | "CONFECCION_EXTERNA" | "DESPACHO" {
  const normalized = normalizeText(raw).toUpperCase();

  if (normalized.includes("INTEGRA")) return "INTEGRACION";
  if (normalized.includes("CONFECCION") || normalized.includes("TERCERO")) return "CONFECCION_EXTERNA";
  if (normalized.includes("DESPACH")) return "DESPACHO";
  return "VIOMAR";
}

function mapDispatchTransport(raw: string | null): "MENSAJERO" | "CONDUCTOR_PROPIO" | "LINEA_TERCERO" {
  const normalized = normalizeText(raw).toUpperCase();

  if (normalized.includes("TERC") || normalized.includes("COURIER") || normalized.includes("LINEA")) {
    return "LINEA_TERCERO";
  }

  if (normalized.includes("CONDUCTOR") || normalized.includes("PROPIO")) {
    return "CONDUCTOR_PROPIO";
  }

  return "MENSAJERO";
}

function mapDispatchStatus(raw: string | null): "CREADO" | "EN_RUTA" | "ENTREGADO" | "RETORNADO" | "INCIDENTE" {
  const normalized = normalizeText(raw).toUpperCase();

  if (normalized.includes("RUTA") || normalized.includes("TRASLADO")) return "EN_RUTA";
  if (normalized.includes("ENTREG")) return "ENTREGADO";
  if (normalized.includes("RETORNO") || normalized.includes("DEVOL")) return "RETORNADO";
  if (normalized.includes("INCIDENT") || normalized.includes("NOVEDAD")) return "INCIDENTE";
  return "CREADO";
}

function mapDispatchPaymentStatus(raw: string | null): "PENDIENTE" | "PARCIAL" | "PAGADO" | "NOTIFICADO_WHATSAPP" {
  const normalized = normalizeText(raw).toUpperCase();

  if (normalized.includes("PAGADO") || normalized.includes("PAGO")) return "PAGADO";
  if (normalized.includes("PARCIAL")) return "PARCIAL";
  if (normalized.includes("WHATSAPP") || normalized.includes("NOTIFIC")) return "NOTIFICADO_WHATSAPP";
  return "PENDIENTE";
}

async function main() {
  const options = parseOptions(process.argv.slice(2));

  const enviosPath = path.join(options.dir, `${options.despachoBase}.envios.json`);
  const envioItemsPath = path.join(options.dir, `${options.despachoBase}.envio_items.json`);
  const ventasPath = path.join(options.dir, `${options.ventasBase}.ventas.json`);
  const seguimientoOrdersPath = path.join(options.dir, `${options.seguimientoBase}.orders.json`);
  const seguimientoItemsPath = path.join(options.dir, `${options.seguimientoBase}.order_items.json`);

  const sourceEnvios = await readJsonFile<unknown[]>(enviosPath);
  const sourceEnvioItems = await readJsonFile<unknown[]>(envioItemsPath);
  const sourceVentas = await readJsonFile<unknown[]>(ventasPath);
  const sourceSeguimientoOrders = await readJsonFile<unknown[]>(seguimientoOrdersPath).catch(() => []);
  const sourceSeguimientoItems = await readJsonFile<unknown[]>(seguimientoItemsPath).catch(() => []);

  const envios = sourceEnvios.map((row) => rawEnvioSchema.safeParse(row)).filter((r) => r.success).map((r) => r.data);
  const envioItems = sourceEnvioItems.map((row) => rawEnvioItemSchema.safeParse(row)).filter((r) => r.success).map((r) => r.data);
  const ventas = sourceVentas.map((row) => rawVentaSchema.safeParse(row)).filter((r) => r.success).map((r) => r.data);
  const seguimientoOrders = sourceSeguimientoOrders.map((row) => rawSeguimientoOrderSchema.safeParse(row)).filter((r) => r.success).map((r) => r.data);
  const seguimientoItems = sourceSeguimientoItems.map((row) => rawSeguimientoOrderItemSchema.safeParse(row)).filter((r) => r.success).map((r) => r.data);

  const ventaByCode = new Map<string, RawVenta>();
  for (const row of ventas) {
    ventaByCode.set(normalizeOrderCode(row.order_code_ref), row);
  }

  const enviosByCode = new Map<string, RawEnvio[]>();
  for (const row of envios) {
    const orderCode = normalizeOrderCode(row.order_code_ref);
    enviosByCode.set(orderCode, [...(enviosByCode.get(orderCode) ?? []), row]);
  }

  const seguimientoOrderByCode = new Map<string, RawSeguimientoOrder>();
  for (const row of seguimientoOrders) {
    seguimientoOrderByCode.set(normalizeOrderCode(row.order_code), row);
  }

  const seguimientoItemsByCode = new Map<string, RawSeguimientoOrderItem[]>();
  for (const row of seguimientoItems) {
    const orderCode = normalizeOrderCode(row.order_code_ref);
    seguimientoItemsByCode.set(orderCode, [...(seguimientoItemsByCode.get(orderCode) ?? []), row]);
  }

  const dispatchAggregatesByCode = new Map<string, DispatchItemAggregate[]>();
  const aggregateMap = new Map<string, DispatchItemAggregate>();
  for (const row of envioItems) {
    const orderCode = normalizeOrderCode(row.order_code_ref);
    const designNumber = row.diseno_ref ?? null;
    if (!orderCode || designNumber === null) {
      continue;
    }
    const key = `${orderCode}|${designNumber}`;
    const aggregate = aggregateMap.get(key) ?? {
      orderCode,
      designNumber,
      quantity: 0,
      packedQuantity: 0,
    };
    aggregate.quantity = Math.max(aggregate.quantity, Number(row.quantity ?? 0));
    aggregate.packedQuantity = Math.max(aggregate.packedQuantity, Number(row.packed_quantity ?? 0));
    aggregateMap.set(key, aggregate);
  }
  for (const aggregate of aggregateMap.values()) {
    dispatchAggregatesByCode.set(aggregate.orderCode, [
      ...(dispatchAggregatesByCode.get(aggregate.orderCode) ?? []),
      aggregate,
    ]);
  }

  const targetCodes = [
    ...new Set([
      ...envios.map((row) => normalizeOrderCode(row.order_code_ref)),
      ...ventas.map((row) => normalizeOrderCode(row.order_code_ref)),
    ].filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  const existingOrders = targetCodes.length === 0
    ? []
    : await erpDb
        .select({
          id: orders.id,
          orderCode: orders.orderCode,
          total: orders.total,
          status: orders.status,
          clientId: orders.clientId,
          orderName: orders.orderName,
        })
        .from(orders)
        .where(inArray(orders.orderCode, targetCodes));

  const orderIdByCode = new Map(existingOrders.map((row) => [String(row.orderCode), row.id]));
  const existingOrderByCode = new Map(existingOrders.map((row) => [String(row.orderCode), row]));
  const reportRows: LinkedImportReportRow[] = [];

  let createdOrders = 0;
  let skippedExistingOrders = 0;
  let skippedInvalidCodes = 0;
  let updatedOrderStatuses = 0;

  for (const orderCode of targetCodes) {
    const trackingOrder = seguimientoOrderByCode.get(orderCode) ?? null;
    const sale = ventaByCode.get(orderCode) ?? null;
    const relatedEnvios = enviosByCode.get(orderCode) ?? [];
    const desiredStatus = resolveLinkedImportOrderStatus({
      trackingStatus: trackingOrder?.status,
      hasVentas: Boolean(sale),
      hasEnvios: relatedEnvios.length > 0,
      hasSeguimiento: Boolean(trackingOrder),
    });
    const sources = [
      ...(trackingOrder ? ["seguimiento"] : []),
      ...(sale ? ["ventas"] : []),
      ...(relatedEnvios.length > 0 ? ["despacho"] : []),
    ];

    if (!hasValidLinkedImportPrefix(orderCode)) {
      skippedInvalidCodes += 1;
      reportRows.push({
        orderCode,
        action: "invalid-code",
        orderId: null,
        previousStatus: null,
        nextStatus: null,
        sources,
      });
      continue;
    }

    const existingOrder = existingOrderByCode.get(orderCode) ?? null;

    if (existingOrder) {
      if (
        shouldUpgradeImportedOrderToProduction({
          currentStatus: existingOrder.status,
          clientId: existingOrder.clientId,
          orderName: existingOrder.orderName,
          hasImportSignals: sources.length > 0,
        })
      ) {
        if (!options.dryRun) {
          await erpDb
            .update(orders)
            .set({ status: desiredStatus })
            .where(eq(orders.id, existingOrder.id));
        }

        updatedOrderStatuses += 1;
        reportRows.push({
          orderCode,
          action: "updated-status",
          orderId: existingOrder.id,
          previousStatus: String(existingOrder.status ?? ""),
          nextStatus: desiredStatus,
          sources,
        });
      } else {
        reportRows.push({
          orderCode,
          action: "reused",
          orderId: existingOrder.id,
          previousStatus: String(existingOrder.status ?? ""),
          nextStatus: String(existingOrder.status ?? ""),
          sources,
        });
      }

      skippedExistingOrders += 1;
      continue;
    }

    const payload = {
      id: trackingOrder?.id ?? buildLinkedImportOrderId(orderCode),
      orderCode,
      type: mapLinkedImportOrderType(orderCode),
      kind:
        trackingOrder?.kind === "COMPLETACION" || trackingOrder?.kind === "REFERENTE"
          ? trackingOrder.kind
          : "NUEVO",
      status: desiredStatus,
      deliveryDate: trackingOrder?.delivery_date ?? undefined,
      total: trackingOrder?.total ?? parseAmount(sale?.total) ?? "0",
      currency: trackingOrder?.currency ?? "COP",
      createdAt: toDate(trackingOrder?.created_at ?? null) ?? undefined,
    } as const;

    if (!options.dryRun) {
      await erpDb.insert(orders).values(payload).onConflictDoNothing({ target: orders.orderCode });
    }

    orderIdByCode.set(orderCode, payload.id);
    createdOrders += 1;
    reportRows.push({
      orderCode,
      action: "created",
      orderId: payload.id,
      previousStatus: null,
      nextStatus: payload.status,
      sources,
    });
  }

  const ensuredOrderIds = Array.from(new Set(orderIdByCode.values()));
  const existingItems = ensuredOrderIds.length === 0
    ? []
    : await erpDb
        .select({ id: orderItems.id, orderId: orderItems.orderId, name: orderItems.name })
        .from(orderItems)
        .where(inArray(orderItems.orderId, ensuredOrderIds));

  const existingItemIds = new Set(existingItems.map((row) => row.id));
  const itemIdByOrderAndDesign = new Map<string, string>();
  for (const row of existingItems) {
    const designMatch = String(row.name ?? "").toUpperCase().match(/DISEÑO\s+(\d+)/);
    if (!row.orderId || !designMatch) {
      continue;
    }
    itemIdByOrderAndDesign.set(`${row.orderId}|${designMatch[1]}`, row.id);
  }

  let createdItems = 0;
  let skippedExistingItems = 0;

  for (const orderCode of targetCodes) {
    const orderId = orderIdByCode.get(orderCode);
    if (!orderId) {
      continue;
    }

    const trackingItems = seguimientoItemsByCode.get(orderCode) ?? [];

    if (trackingItems.length > 0) {
      for (const row of trackingItems) {
        const byDesignKey = `${orderId}|${row.diseno_numero}`;
        if (existingItemIds.has(row.id) || itemIdByOrderAndDesign.has(byDesignKey)) {
          skippedExistingItems += 1;
          itemIdByOrderAndDesign.set(byDesignKey, row.id);
          continue;
        }

        const payload = {
          id: row.id,
          orderId,
          name: row.name ?? buildLinkedImportOrderItemName(row.diseno_numero),
          garmentType: row.garment_type ?? undefined,
          fabric: row.fabric ?? undefined,
          gender: row.gender ?? undefined,
          quantity: Math.max(0, Number(row.quantity ?? 0)),
          estimatedLeadDays: row.estimated_lead_days ?? undefined,
          status:
            row.status === "DESPACHO"
              ? "ENVIADO"
              : row.status === "EN_PRODUCCION"
                ? "PENDIENTE_PRODUCCION"
                : row.status === "AVAL"
                  ? "APROBACION"
                  : "PENDIENTE",
          isActive: true,
          hasAdditions: false,
          screenPrint: false,
          embroidery: false,
          buttonhole: false,
          snap: false,
          tag: false,
          flag: false,
        } as const;

        if (!options.dryRun) {
          await erpDb.insert(orderItems).values(payload);
        }

        existingItemIds.add(payload.id);
        itemIdByOrderAndDesign.set(byDesignKey, payload.id);
        createdItems += 1;
      }

      continue;
    }

    const fallbackItems = dispatchAggregatesByCode.get(orderCode) ?? [];
    for (const aggregate of fallbackItems) {
      const byDesignKey = `${orderId}|${aggregate.designNumber}`;
      if (itemIdByOrderAndDesign.has(byDesignKey)) {
        skippedExistingItems += 1;
        continue;
      }

      const payload = {
        id: buildLinkedImportOrderItemId(orderCode, aggregate.designNumber),
        orderId,
        name: buildLinkedImportOrderItemName(aggregate.designNumber),
        quantity: Math.max(aggregate.quantity, aggregate.packedQuantity, 1),
        status: "ENVIADO",
        isActive: true,
        hasAdditions: false,
        screenPrint: false,
        embroidery: false,
        buttonhole: false,
        snap: false,
        tag: false,
        flag: false,
      } as const;

      if (!options.dryRun) {
        await erpDb.insert(orderItems).values(payload).onConflictDoNothing({ target: orderItems.id });
      }

      itemIdByOrderAndDesign.set(byDesignKey, payload.id);
      createdItems += 1;
    }
  }

  let insertedEnvios = 0;
  let skippedEnvios = 0;
  let missingOrderMatches = 0;
  const envioIdMap = new Map<string, string>();

  for (const row of envios) {
    const orderCode = normalizeOrderCode(row.order_code_ref);
    const orderId = orderIdByCode.get(orderCode);
    if (!orderId) {
      skippedEnvios += 1;
      missingOrderMatches += 1;
      continue;
    }

    const exists = await mesDb
      .select({ id: mesEnvios.id })
      .from(mesEnvios)
      .where(eq(mesEnvios.id, row.id))
      .limit(1);

    if (exists.length > 0) {
      envioIdMap.set(row.id, row.id);
      skippedEnvios += 1;
      continue;
    }

    if (!options.dryRun) {
      await mesDb.insert(mesEnvios).values({
        id: row.id,
        orderId,
        origenArea: mapDispatchArea(row.origen_area),
        origenNombre: row.origen_nombre ?? undefined,
        destinoArea: mapDispatchArea(row.destino_area),
        destinoNombre: row.destino_nombre ?? undefined,
        transporteTipo: mapDispatchTransport(row.transporte_tipo),
        status: mapDispatchStatus(row.status),
        paymentStatus: mapDispatchPaymentStatus(row.payment_status),
        salidaAt: toDate(row.salida_at) ?? undefined,
        llegadaAt: toDate(row.llegada_at) ?? undefined,
        retornoAt: toDate(row.retorno_at) ?? undefined,
        logisticOperator: row.logistic_operator ?? undefined,
        destinationAddress: row.destination_address ?? undefined,
        requiresDeclaredValue: Boolean(row.requires_declared_value),
        courierBroughtBy: row.courier_brought_by ?? undefined,
        receptionLocation: row.reception_location ?? undefined,
        receptionStatus: row.reception_status ?? undefined,
        observaciones: row.observaciones ?? undefined,
      });
    }

    envioIdMap.set(row.id, row.id);
    insertedEnvios += 1;
  }

  let insertedEnvioItems = 0;
  let skippedEnvioItems = 0;
  let missingOrderItemMatches = 0;

  for (const row of envioItems) {
    const envioId = envioIdMap.get(row.envio_id);
    if (!envioId) {
      skippedEnvioItems += 1;
      continue;
    }

    let itemId: string | null = null;
    if (isUuid(row.order_item_id_ref)) {
      itemId = String(row.order_item_id_ref).trim();
    } else {
      const orderCode = normalizeOrderCode(row.order_code_ref);
      const orderId = orderIdByCode.get(orderCode);
      const designNumber = row.diseno_ref ?? null;
      if (orderId && designNumber !== null) {
        itemId = itemIdByOrderAndDesign.get(`${orderId}|${designNumber}`) ?? null;
      }
    }

    if (!itemId) {
      skippedEnvioItems += 1;
      missingOrderItemMatches += 1;
      continue;
    }

    const exists = await mesDb
      .select({ id: mesEnvioItems.id })
      .from(mesEnvioItems)
      .where(eq(mesEnvioItems.id, row.id))
      .limit(1);

    if (exists.length > 0) {
      skippedEnvioItems += 1;
      continue;
    }

    if (!options.dryRun) {
      await mesDb.insert(mesEnvioItems).values({
        id: row.id,
        envioId,
        orderItemId: itemId,
        quantity: Math.max(0, Number(row.quantity ?? 0)),
        packedQuantity: row.packed_quantity == null ? undefined : Math.max(0, Number(row.packed_quantity ?? 0)),
        notes: row.notes ?? undefined,
      });
    }

    insertedEnvioItems += 1;
  }

  let updatedVentas = 0;
  let skippedVentas = 0;
  let missingVentaOrders = 0;

  for (const row of ventas) {
    const orderCode = normalizeOrderCode(row.order_code_ref);
    const orderId = orderIdByCode.get(orderCode);
    if (!orderId) {
      skippedVentas += 1;
      missingVentaOrders += 1;
      continue;
    }

    const total = parseAmount(row.total);
    if (!total) {
      skippedVentas += 1;
      continue;
    }

    if (!options.dryRun) {
      await erpDb.update(orders).set({ total }).where(eq(orders.id, orderId));
    }

    updatedVentas += 1;
  }

  if (!options.dryRun) {
    const reportPath = path.join(options.dir, "reporte_import_historico_vinculado.json");
    await writeFile(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          summary: {
            createdOrders,
            skippedExistingOrders,
            skippedInvalidCodes,
            updatedOrderStatuses,
            createdItems,
            skippedExistingItems,
            insertedEnvios,
            skippedEnvios,
            insertedEnvioItems,
            skippedEnvioItems,
            updatedVentas,
            skippedVentas,
          },
          items: reportRows,
        },
        null,
        2,
      ),
      "utf8",
    );
  }

  console.log(`mode=${options.dryRun ? "DRY_RUN" : "APPLY"}`);
  console.log(`created orders=${createdOrders}`);
  console.log(`skipped existing orders=${skippedExistingOrders}`);
  console.log(`skipped invalid codes=${skippedInvalidCodes}`);
  console.log(`updated order statuses=${updatedOrderStatuses}`);
  console.log(`created order_items=${createdItems}`);
  console.log(`skipped existing order_items=${skippedExistingItems}`);
  console.log(`mes_envios inserted=${insertedEnvios}, skipped=${skippedEnvios}, missingOrders=${missingOrderMatches}`);
  console.log(`mes_envio_items inserted=${insertedEnvioItems}, skipped=${skippedEnvioItems}, missingOrderItems=${missingOrderItemMatches}`);
  console.log(`ventas updated=${updatedVentas}, skipped=${skippedVentas}, missingOrders=${missingVentaOrders}`);
}

void main();