import "dotenv/config";

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  makeDeterministicUuid,
  normalizeHeaderKey,
  normalizeOrderCode,
  normalizeText,
  parseBoolean,
  parseExcelDate,
  parseInteger,
  pickFirstValue,
  readWorksheetRows,
  listWorkbookSheetNames,
  type WorksheetRow,
} from "@/src/imports/historical-excel/helpers";
import {
  rawEnvioItemSchema,
  rawEnvioSchema,
  type RawEnvio,
  type RawEnvioItem,
} from "@/src/imports/historical-excel/schemas";

type CliOptions = {
  file: string;
  outDir: string;
  base: string;
  enviosSheet?: string;
  itemsSheet?: string;
  dryRun: boolean;
};

const ENVIO_ALIASES = {
  orderCode: ["order_code_ref", "order_code", "pedido", "pedido_ref", "codigo_pedido", "codigo pedido"],
  origenArea: ["origen_area", "area_origen", "origen", "proceso_origen"],
  origenNombre: ["origen_nombre", "nombre_origen", "quien_envia", "envia", "remitente"],
  destinoArea: ["destino_area", "area_destino", "destino", "proceso_destino"],
  destinoNombre: ["destino_nombre", "nombre_destino", "quien_recibe", "recibe", "destinatario"],
  transporteTipo: ["transporte_tipo", "tipo_transporte", "transportista_tipo", "medio_transporte"],
  status: ["status", "estado", "estado_envio"],
  paymentStatus: ["payment_status", "estado_pago", "pago", "paymentstatus"],
  salidaAt: ["salida_at", "fecha_salida", "hora_salida", "fecha_hora_salida"],
  llegadaAt: ["llegada_at", "fecha_llegada", "hora_llegada", "fecha_hora_llegada"],
  retornoAt: ["retorno_at", "fecha_retorno", "hora_retorno", "fecha_hora_retorno"],
  logisticOperator: ["logistic_operator", "operador_logistico", "transportadora", "empresa_logistica"],
  destinationAddress: ["destination_address", "direccion_destino", "direccion", "direccion_entrega"],
  requiresDeclaredValue: ["requires_declared_value", "requiere_valor_declarado", "valor_declarado"],
  courierBroughtBy: ["courier_brought_by", "traido_por", "mensajero", "courier"],
  receptionLocation: ["reception_location", "lugar_recepcion", "recepcion", "sitio_recepcion"],
  receptionStatus: ["reception_status", "estado_recepcion", "recibido_estado"],
  observaciones: ["observaciones", "notas", "comments", "notes"],
  explicitId: ["id", "envio_id", "shipment_id"],
} as const;

const ITEM_ALIASES = {
  envioId: ["envio_id", "shipment_id", "id_envio"],
  orderItemId: ["order_item_id_ref", "order_item_id", "item_pedido_id", "id_item_pedido"],
  orderCode: ["order_code_ref", "order_code", "pedido", "codigo_pedido"],
  diseno: ["diseno_ref", "diseno", "diseño", "diseno_numero", "numero_diseno"],
  quantity: ["quantity", "cantidad", "qty"],
  packedQuantity: ["packed_quantity", "cantidad_empacada", "packed", "empacado"],
  notes: ["notes", "observaciones", "notas"],
  explicitId: ["id", "envio_item_id", "item_id"],
} as const;

function resolveDefaultFile() {
  const candidates = [
    "data/imports/MATRIZ DE DESPACHO.xlsx",
    "D:/Programación/Vio/MATRIZ DE DESPACHO.xlsx",
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function resolveDefaultOutDir(defaultFile: string) {
  const externalRoot = "D:/Programación/Vio";
  return defaultFile.startsWith(externalRoot) ? externalRoot : "data/imports/normalized";
}

function parseOptions(argv: string[]): CliOptions {
  const defaultFile = resolveDefaultFile();
  const options: CliOptions = {
    file: defaultFile,
    outDir: resolveDefaultOutDir(defaultFile),
    base: "datos_despacho_normalizada",
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--file") {
      options.file = argv[index + 1] ?? options.file;
      index += 1;
      continue;
    }

    if (arg === "--out-dir") {
      options.outDir = argv[index + 1] ?? options.outDir;
      index += 1;
      continue;
    }

    if (arg === "--base") {
      options.base = argv[index + 1] ?? options.base;
      index += 1;
      continue;
    }

    if (arg === "--envios-sheet") {
      options.enviosSheet = argv[index + 1] ?? options.enviosSheet;
      index += 1;
      continue;
    }

    if (arg === "--items-sheet") {
      options.itemsSheet = argv[index + 1] ?? options.itemsSheet;
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function inferSheetNames(filePath: string, options: CliOptions) {
  const sheetNames = listWorkbookSheetNames(filePath);
  const enviosSheet =
    options.enviosSheet ??
    sheetNames.find((sheet) => /envio|despacho|matriz/i.test(sheet)) ??
    sheetNames[0];
  const itemsSheet =
    options.itemsSheet ??
    sheetNames.find((sheet) => /item|detalle|producto/i.test(sheet)) ??
    sheetNames[1];

  if (!enviosSheet) {
    throw new Error(`No se encontraron hojas en ${filePath}.`);
  }

  return { enviosSheet, itemsSheet: itemsSheet ?? null, sheetNames };
}

function buildEnvioId(row: WorksheetRow) {
  const explicit = pickFirstValue(row, ENVIO_ALIASES.explicitId);
  const explicitText = normalizeText(explicit);

  if (/^[0-9a-f]{8}-/i.test(explicitText)) {
    return explicitText.toLowerCase();
  }

  const seed = [
    normalizeOrderCode(String(pickFirstValue(row, ENVIO_ALIASES.orderCode) ?? "")),
    normalizeText(pickFirstValue(row, ENVIO_ALIASES.salidaAt)),
    normalizeText(pickFirstValue(row, ENVIO_ALIASES.destinoNombre)),
    normalizeText(pickFirstValue(row, ENVIO_ALIASES.status)),
  ].join("|");

  return makeDeterministicUuid("despacho-envio", seed);
}

function normalizeEnvioRow(row: WorksheetRow): RawEnvio | null {
  const orderCode = normalizeOrderCode(
    String(pickFirstValue(row, ENVIO_ALIASES.orderCode) ?? ""),
  );

  if (!orderCode) {
    return null;
  }

  const payload = {
    id: buildEnvioId(row),
    order_code_ref: orderCode,
    origen_area: normalizeText(pickFirstValue(row, ENVIO_ALIASES.origenArea)) || null,
    origen_nombre: normalizeText(pickFirstValue(row, ENVIO_ALIASES.origenNombre)) || null,
    destino_area: normalizeText(pickFirstValue(row, ENVIO_ALIASES.destinoArea)) || null,
    destino_nombre: normalizeText(pickFirstValue(row, ENVIO_ALIASES.destinoNombre)) || null,
    transporte_tipo: normalizeText(pickFirstValue(row, ENVIO_ALIASES.transporteTipo)) || null,
    status: normalizeText(pickFirstValue(row, ENVIO_ALIASES.status)) || null,
    payment_status: normalizeText(pickFirstValue(row, ENVIO_ALIASES.paymentStatus)) || null,
    salida_at: parseExcelDate(pickFirstValue(row, ENVIO_ALIASES.salidaAt)),
    llegada_at: parseExcelDate(pickFirstValue(row, ENVIO_ALIASES.llegadaAt)),
    retorno_at: parseExcelDate(pickFirstValue(row, ENVIO_ALIASES.retornoAt)),
    logistic_operator: normalizeText(pickFirstValue(row, ENVIO_ALIASES.logisticOperator)) || null,
    destination_address: normalizeText(pickFirstValue(row, ENVIO_ALIASES.destinationAddress)) || null,
    requires_declared_value: parseBoolean(pickFirstValue(row, ENVIO_ALIASES.requiresDeclaredValue)),
    courier_brought_by: normalizeText(pickFirstValue(row, ENVIO_ALIASES.courierBroughtBy)) || null,
    reception_location: normalizeText(pickFirstValue(row, ENVIO_ALIASES.receptionLocation)) || null,
    reception_status: normalizeText(pickFirstValue(row, ENVIO_ALIASES.receptionStatus)) || null,
    observaciones: normalizeText(pickFirstValue(row, ENVIO_ALIASES.observaciones)) || null,
  };

  return rawEnvioSchema.parse(payload);
}

function normalizeEnvioItemRow(
  row: WorksheetRow,
  enviosByNaturalKey: Map<string, string>,
): RawEnvioItem | null {
  const orderCode = normalizeOrderCode(
    String(pickFirstValue(row, ITEM_ALIASES.orderCode) ?? ""),
  );
  const explicitEnvioId = normalizeText(pickFirstValue(row, ITEM_ALIASES.envioId));
  const envioId = /^[0-9a-f]{8}-/i.test(explicitEnvioId)
    ? explicitEnvioId.toLowerCase()
    : enviosByNaturalKey.get(orderCode) ?? null;

  if (!envioId) {
    return null;
  }

  const design = parseInteger(pickFirstValue(row, ITEM_ALIASES.diseno));
  const explicitId = normalizeText(pickFirstValue(row, ITEM_ALIASES.explicitId));
  const itemId = /^[0-9a-f]{8}-/i.test(explicitId)
    ? explicitId.toLowerCase()
    : makeDeterministicUuid(
        "despacho-envio-item",
        [envioId, orderCode, String(design ?? ""), String(pickFirstValue(row, ITEM_ALIASES.quantity) ?? "")].join("|"),
      );

  const payload = {
    id: itemId,
    envio_id: envioId,
    order_item_id_ref: normalizeText(pickFirstValue(row, ITEM_ALIASES.orderItemId)) || null,
    order_code_ref: orderCode || null,
    diseno_ref: design,
    quantity: parseInteger(pickFirstValue(row, ITEM_ALIASES.quantity)),
    packed_quantity: parseInteger(pickFirstValue(row, ITEM_ALIASES.packedQuantity)),
    notes: normalizeText(pickFirstValue(row, ITEM_ALIASES.notes)) || null,
  };

  return rawEnvioItemSchema.parse(payload);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const { enviosSheet, itemsSheet, sheetNames } = inferSheetNames(options.file, options);

  const enviosRows = readWorksheetRows(options.file, enviosSheet);
  const envios = enviosRows
    .map((row) => normalizeEnvioRow(row))
    .filter((row): row is RawEnvio => row !== null);
  const enviosByOrderCode = new Map(envios.map((row) => [row.order_code_ref, row.id]));

  const itemRows = itemsSheet ? readWorksheetRows(options.file, itemsSheet) : [];
  const envioItems = itemRows
    .map((row) => normalizeEnvioItemRow(row, enviosByOrderCode))
    .filter((row): row is RawEnvioItem => row !== null);

  const summary = {
    mode: options.dryRun ? "DRY_RUN" : "APPLY",
    file: path.resolve(options.file),
    sheets: sheetNames,
    enviosSheet,
    itemsSheet,
    envios: envios.length,
    envioItems: envioItems.length,
    skippedEnvios: enviosRows.length - envios.length,
    skippedEnvioItems: itemRows.length - envioItems.length,
    detectedHeaders: {
      envios: enviosRows[0] ? Object.keys(enviosRows[0]).map((value) => normalizeHeaderKey(value)) : [],
      items: itemRows[0] ? Object.keys(itemRows[0]).map((value) => normalizeHeaderKey(value)) : [],
    },
  };

  if (!options.dryRun) {
    await mkdir(options.outDir, { recursive: true });
    await writeFile(
      path.join(options.outDir, `${options.base}.envios.json`),
      JSON.stringify(envios, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(options.outDir, `${options.base}.envio_items.json`),
      JSON.stringify(envioItems, null, 2),
      "utf8",
    );
  }

  console.log(JSON.stringify(summary, null, 2));
}

void main();