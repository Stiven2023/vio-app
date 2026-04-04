import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { eq, inArray } from "drizzle-orm";

import { mesDb } from "../src/db/mes";
import { mesEnvioItems, mesEnvios } from "../src/db/mes/schema";
import { erpDb } from "../src/db/erp";
import { orderItems, orders } from "../src/db/schema";

type CliOptions = {
  dir: string;
  base: string;
  dryRun: boolean;
};

type RawEnvio = {
  id: string;
  order_code_ref: string;
  origen_area: string | null;
  origen_nombre: string | null;
  destino_area: string | null;
  destino_nombre: string | null;
  transporte_tipo: string | null;
  status: string | null;
  payment_status: string | null;
  salida_at: string | null;
  llegada_at: string | null;
  retorno_at: string | null;
  logistic_operator: string | null;
  destination_address: string | null;
  requires_declared_value: boolean | null;
  courier_brought_by: string | null;
  reception_location: string | null;
  reception_status: string | null;
  observaciones: string | null;
};

type RawEnvioItem = {
  id: string;
  envio_id: string;
  order_item_id_ref: string | null;
  order_code_ref: string | null;
  diseno_ref: number | null;
  quantity: number | null;
  packed_quantity: number | null;
  notes: string | null;
};

const UUID_V4_OR_V1_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    dir: "D:/Programación/Vio",
    base: "datos_despacho_normalizada",
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

function mapArea(raw: string | null): "VIOMAR" | "INTEGRACION" | "CONFECCION_EXTERNA" | "DESPACHO" {
  const normalized = (raw ?? "").trim().toUpperCase();

  if (normalized.includes("INTEGRA")) {
    return "INTEGRACION";
  }

  if (normalized.includes("CONFECCION") || normalized.includes("TERCERO")) {
    return "CONFECCION_EXTERNA";
  }

  if (normalized.includes("DESPACH")) {
    return "DESPACHO";
  }

  return "VIOMAR";
}

function mapTransport(raw: string | null): "MENSAJERO" | "CONDUCTOR_PROPIO" | "LINEA_TERCERO" {
  const normalized = (raw ?? "").trim().toUpperCase();

  if (normalized.includes("TERC") || normalized.includes("COURIER") || normalized.includes("LINEA")) {
    return "LINEA_TERCERO";
  }

  if (normalized.includes("CONDUCTOR") || normalized.includes("PROPIO")) {
    return "CONDUCTOR_PROPIO";
  }

  return "MENSAJERO";
}

function mapStatus(raw: string | null): "CREADO" | "EN_RUTA" | "ENTREGADO" | "RETORNADO" | "INCIDENTE" {
  const normalized = (raw ?? "").trim().toUpperCase();

  if (normalized.includes("RUTA") || normalized.includes("TRASLADO")) {
    return "EN_RUTA";
  }

  if (normalized.includes("ENTREG")) {
    return "ENTREGADO";
  }

  if (normalized.includes("RETORNO") || normalized.includes("DEVOL")) {
    return "RETORNADO";
  }

  if (normalized.includes("INCIDENT") || normalized.includes("NOVEDAD")) {
    return "INCIDENTE";
  }

  return "CREADO";
}

function mapPaymentStatus(raw: string | null): "PENDIENTE" | "PARCIAL" | "PAGADO" | "NOTIFICADO_WHATSAPP" {
  const normalized = (raw ?? "").trim().toUpperCase();

  if (normalized.includes("PAGADO") || normalized.includes("PAGO")) {
    return "PAGADO";
  }

  if (normalized.includes("PARCIAL")) {
    return "PARCIAL";
  }

  if (normalized.includes("WHATSAPP") || normalized.includes("NOTIFIC")) {
    return "NOTIFICADO_WHATSAPP";
  }

  return "PENDIENTE";
}

function toDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
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

function isUuid(value: string | null | undefined): boolean {
  return UUID_V4_OR_V1_RE.test(String(value ?? "").trim());
}

async function resolveOrderItemId(row: RawEnvioItem): Promise<string | null> {
  if (isUuid(row.order_item_id_ref)) {
    return String(row.order_item_id_ref).trim();
  }

  const orderCode = normalizeOrderCode(row.order_code_ref);

  if (!orderCode) {
    return null;
  }

  const orderRows = await erpDb
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.orderCode, orderCode))
    .limit(1);

  const orderId = orderRows[0]?.id;
  if (!orderId) {
    return null;
  }

  const candidates = await erpDb
    .select({ id: orderItems.id, name: orderItems.name })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  if (candidates.length === 0) {
    return null;
  }

  const designNumber = row.diseno_ref ?? null;
  if (designNumber === null) {
    return candidates[0]?.id ?? null;
  }

  const byDesignName = candidates.find((candidate) =>
    (candidate.name ?? "").toUpperCase().includes(`DISEÑO ${designNumber}`),
  );

  return byDesignName?.id ?? candidates[0]?.id ?? null;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));

  const enviosPath = path.join(options.dir, `${options.base}.envios.json`);
  const envioItemsPath = path.join(options.dir, `${options.base}.envio_items.json`);

  const rawEnvios = await readJsonFile<RawEnvio[]>(enviosPath);
  const rawEnvioItems = await readJsonFile<RawEnvioItem[]>(envioItemsPath);

  const orderCodes = [
    ...new Set(
      rawEnvios
        .map((row) => normalizeOrderCode(row.order_code_ref))
        .filter((code) => code.length > 0),
    ),
  ];
  const orderRows =
    orderCodes.length === 0
      ? []
      : await erpDb
          .select({ id: orders.id, orderCode: orders.orderCode })
          .from(orders)
          .where(inArray(orders.orderCode, orderCodes));

  const orderIdByCode = new Map(orderRows.map((row) => [row.orderCode, row.id]));

  let insertedEnvios = 0;
  let skippedEnvios = 0;

  const envioIdMap = new Map<string, string>();

  for (const row of rawEnvios) {
    const orderCode = normalizeOrderCode(row.order_code_ref);
    const orderId = orderIdByCode.get(orderCode);
    if (!orderId) {
      skippedEnvios += 1;
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

    if (options.dryRun) {
      envioIdMap.set(row.id, row.id);
      insertedEnvios += 1;
      continue;
    }

    await mesDb.insert(mesEnvios).values({
      id: row.id,
      orderId,
      origenArea: mapArea(row.origen_area),
      origenNombre: row.origen_nombre ?? undefined,
      destinoArea: mapArea(row.destino_area),
      destinoNombre: row.destino_nombre ?? undefined,
      transporteTipo: mapTransport(row.transporte_tipo),
      status: mapStatus(row.status),
      paymentStatus: mapPaymentStatus(row.payment_status),
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

    envioIdMap.set(row.id, row.id);
    insertedEnvios += 1;
  }

  let insertedItems = 0;
  let skippedItems = 0;

  for (const row of rawEnvioItems) {
    const envioId = envioIdMap.get(row.envio_id);
    if (!envioId) {
      skippedItems += 1;
      continue;
    }

    const itemId = await resolveOrderItemId(row);
    if (!itemId) {
      skippedItems += 1;
      continue;
    }

    const exists = await mesDb
      .select({ id: mesEnvioItems.id })
      .from(mesEnvioItems)
      .where(eq(mesEnvioItems.id, row.id))
      .limit(1);

    if (exists.length > 0) {
      skippedItems += 1;
      continue;
    }

    if (options.dryRun) {
      insertedItems += 1;
      continue;
    }

    await mesDb.insert(mesEnvioItems).values({
      id: row.id,
      envioId,
      orderItemId: itemId,
      quantity: Math.max(0, Number(row.quantity ?? 0)),
      packedQuantity: row.packed_quantity == null ? undefined : Math.max(0, Number(row.packed_quantity)),
      notes: row.notes ?? undefined,
    });

    insertedItems += 1;
  }

  console.log(`mode=${options.dryRun ? "DRY_RUN" : "APPLY"}`);
  console.log(`mes_envios: inserted=${insertedEnvios}, skipped=${skippedEnvios}`);
  console.log(`mes_envio_items: inserted=${insertedItems}, skipped=${skippedItems}`);
}

void main();
