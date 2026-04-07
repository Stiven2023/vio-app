import "dotenv/config";

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  listWorkbookSheetNames,
  makeDeterministicUuid,
  normalizeHeaderKey,
  normalizeOrderCode,
  normalizeText,
  parseAmount,
  parseBoolean,
  parseExcelDate,
  parseInteger,
  pickFirstValue,
  readWorksheetRows,
  type WorksheetRow,
} from "@/src/imports/historical-excel/helpers";
import {
  isSeguimientoLogSheetCandidate,
  resolveSeguimientoOperationType,
  resolveSeguimientoProcessCode,
  resolveSeguimientoRoleArea,
} from "@/src/imports/historical-excel/seguimiento";
import {
  rawSeguimientoLogSchema,
  rawSeguimientoOrderItemSchema,
  rawSeguimientoOrderSchema,
  rawSeguimientoPackagingSchema,
  type RawSeguimientoLog,
  type RawSeguimientoOrder,
  type RawSeguimientoOrderItem,
  type RawSeguimientoPackaging,
} from "@/src/imports/historical-excel/schemas";

type CliOptions = {
  file: string;
  outDir: string;
  base: string;
  ordersSheet?: string;
  itemsSheet?: string;
  packagingSheet?: string;
  logsSheets?: string[];
  dryRun: boolean;
};

type ProgramacionProcessConfig = {
  operationType: "MONTAJE" | "PLOTTER" | "SUBLIMACION" | "CORTE_MANUAL";
  roleAlias: readonly string[];
  startAlias: readonly string[];
  endAlias: readonly string[];
  quantityAlias?: readonly string[];
  partialAlias?: readonly string[];
};

const ORDER_ALIASES = {
  explicitId: ["id", "order_id", "pedido_id"],
  orderCode: ["order_code", "pedido", "codigo_pedido", "order_code_ref"],
  createdAt: ["created_at", "fecha_creacion", "fecha_pedido"],
  deliveryDate: ["delivery_date", "fecha_entrega", "fecha_compromiso"],
  kind: ["kind", "tipo", "tipo_pedido"],
  status: ["status", "estado"],
  total: ["total", "valor_total", "monto_total"],
  currency: ["currency", "moneda"],
} as const;

const ITEM_ALIASES = {
  explicitId: ["id", "order_item_id", "item_id", "detalle_id"],
  orderIdRef: ["order_id_ref", "order_id", "pedido_id", "pedido_ref_id"],
  orderCode: ["order_code_ref", "order_code", "pedido", "codigo_pedido"],
  designNumber: ["diseno_numero", "diseno", "diseño", "numero_diseno", "diseno_ref"],
  name: ["name", "diseno_nombre", "detalle", "design_name"],
  garmentType: ["garment_type", "prenda", "tipo_prenda"],
  fabric: ["fabric", "tela"],
  gender: ["gender", "genero", "género"],
  quantity: ["quantity", "cantidad", "qty"],
  estimatedLeadDays: ["estimated_lead_days", "dias_estimados", "lead_days"],
  status: ["status", "estado"],
} as const;

const PROGRAMACION_ALIASES = {
  sellerName: ["seller_name", "vendedor", "asesor", "asesor_principal"],
  size: ["size", "talla"],
  quantity: ["quantity", "cantidad"],
  observations: ["observations", "observacion"],
} as const;

const PROGRAMACION_PROCESS_CONFIGS: ProgramacionProcessConfig[] = [
  {
    operationType: "MONTAJE",
    roleAlias: ["responsable"],
    startAlias: ["fecha_inicio_montaje"],
    endAlias: ["fecha_final_montaje"],
  },
  {
    operationType: "PLOTTER",
    roleAlias: ["responsable_1"],
    startAlias: ["fecha_inicio_plotter"],
    endAlias: ["fecha_final_plotter"],
    quantityAlias: ["cantidad_1"],
    partialAlias: ["completo_parcial"],
  },
  {
    operationType: "SUBLIMACION",
    roleAlias: ["responsable_2"],
    startAlias: ["fecha_inicio_sublimacion"],
    endAlias: ["fecha_final_sublimacion"],
    quantityAlias: ["cantidades"],
    partialAlias: ["completo_parcial_1"],
  },
  {
    operationType: "CORTE_MANUAL",
    roleAlias: ["responsable_3"],
    startAlias: ["fecha_inicio_corte"],
    endAlias: ["fecha_final_corte"],
    quantityAlias: ["cantidad_2"],
    partialAlias: ["completo_parcial_2"],
  },
];

const PACKAGING_ALIASES = {
  explicitId: ["id", "packaging_id", "empaque_id"],
  orderItemId: ["order_item_id", "item_id", "detalle_id", "order_item_id_ref"],
  orderCode: ["order_code", "pedido", "codigo_pedido"],
  designNumber: ["diseno", "diseño", "diseno_numero", "diseno_ref"],
  size: ["size", "talla"],
  quantity: ["quantity", "cantidad", "qty"],
  mode: ["mode", "modo", "tipo_empaque"],
} as const;

const LOG_ALIASES = {
  explicitId: ["id", "log_id", "seguimiento_id"],
  orderItemId: ["order_item_id", "item_id", "detalle_id", "order_item_id_ref"],
  orderCode: ["order_code", "pedido", "codigo_pedido"],
  designName: ["design_name", "diseno_nombre", "detalle", "name"],
  roleArea: ["role_area", "area_rol", "rol_area", "area"],
  operationType: ["operation_type", "operacion", "proceso", "tipo_operacion"],
  processCode: ["process_code", "codigo_proceso", "codigo", "proceso_codigo"],
  size: ["size", "talla"],
  quantityOp: ["quantity_op", "cantidad_operada", "cantidad", "qty"],
  producedQuantity: ["produced_quantity", "cantidad_producida", "producido"],
  startAt: ["start_at", "inicio", "fecha_inicio", "hora_inicio"],
  endAt: ["end_at", "fin", "fecha_fin", "hora_fin"],
  isComplete: ["is_complete", "completo", "finalizado"],
  isPartial: ["is_partial", "parcial"],
  observations: ["observations", "observaciones", "notas"],
  repoCheck: ["repo_check", "reposicion", "repo", "requiere_repo"],
} as const;

function resolveDefaultFile() {
  const candidates = [
    "data/imports/SEGUIMIENTO PRODUCCION.xlsx",
    "D:/Programación/Vio/SEGUIMIENTO PRODUCCION.xlsx",
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
    base: "datos_seguimiento_normalizada",
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

    if (arg === "--orders-sheet") {
      options.ordersSheet = argv[index + 1] ?? options.ordersSheet;
      index += 1;
      continue;
    }

    if (arg === "--items-sheet") {
      options.itemsSheet = argv[index + 1] ?? options.itemsSheet;
      index += 1;
      continue;
    }

    if (arg === "--packaging-sheet") {
      options.packagingSheet = argv[index + 1] ?? options.packagingSheet;
      index += 1;
      continue;
    }

    if (arg === "--logs-sheets") {
      options.logsSheets = String(argv[index + 1] ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function inferSheetSelection(filePath: string, options: CliOptions) {
  const sheetNames = listWorkbookSheetNames(filePath);
  const baseProgramacionSheets = sheetNames.filter((sheet) =>
    /^(programacion|programacion_actualizacion|copia produ|bodega)$/i.test(
      normalizeText(sheet),
    ),
  );
  const programacionSheets = baseProgramacionSheets.length > 0
    ? baseProgramacionSheets
    : sheetNames.filter((sheet) => /(programacion|produ)/i.test(sheet));
  const ordersSheet =
    options.ordersSheet ??
    programacionSheets.find((sheet) => /^programacion$/i.test(normalizeText(sheet))) ??
    programacionSheets[0] ??
    sheetNames.find((sheet) => /(pedido|order(?!_items)|orden)/i.test(sheet)) ??
    sheetNames[0] ??
    null;
  const itemsSheet =
    options.itemsSheet ??
    ordersSheet ??
    programacionSheets[0] ??
    null;
  const packagingSheet =
    options.packagingSheet ??
    sheetNames.find((sheet) => /(empaque|packaging|talla|size)/i.test(sheet)) ??
    null;

  const explicitLogs = options.logsSheets?.filter((sheet) => sheetNames.includes(sheet)) ?? [];
  const usedSheets = new Set([ordersSheet, itemsSheet, packagingSheet].filter(Boolean));
  const inferredLogs =
    explicitLogs.length > 0
      ? explicitLogs
      : sheetNames.filter(
          (sheet) =>
            !usedSheets.has(sheet) &&
            (/(formato control produccion|formato control reposicion)/i.test(sheet) ||
              isSeguimientoLogSheetCandidate(sheet)),
        );

  const logsSheets = inferredLogs.length > 0
    ? inferredLogs
    : sheetNames.filter((sheet) => !usedSheets.has(sheet));

  if (!ordersSheet) {
    throw new Error(`No se pudo inferir la hoja de pedidos en ${filePath}.`);
  }

  if (!itemsSheet) {
    throw new Error(`No se pudo inferir la hoja de items en ${filePath}.`);
  }

  if (logsSheets.length === 0) {
    throw new Error(`No se encontraron hojas de seguimiento/logs en ${filePath}.`);
  }

  return {
    sheetNames,
    ordersSheet,
    itemsSheet,
    programacionSheets,
    packagingSheet,
    logsSheets,
  };
}

function dedupeById<T extends { id: string }>(rows: T[]) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

function pickSeguimientoPositionalValue(
  row: WorksheetRow,
  keys: readonly string[],
  position: number,
) {
  for (const key of keys) {
    if (key in row) {
      return row[key];
    }
  }

  return Object.values(row)[position] ?? null;
}

function resolveControlSheetProcess(
  values: unknown[],
  isReposicion: boolean,
): { processCode: "P" | "S" | "C"; operationType: string } {
  const processStartIndex = isReposicion ? 10 : 11;
  const pFlag = parseBoolean(values[processStartIndex]);
  const sFlag = parseBoolean(values[processStartIndex + 1]);
  const cFlag = parseBoolean(values[processStartIndex + 2]);

  if (sFlag) {
    return { processCode: "S", operationType: "SUBLIMACION" };
  }

  if (cFlag) {
    return { processCode: "C", operationType: "CORTE_MANUAL" };
  }

  if (pFlag) {
    return { processCode: "P", operationType: "PLOTTER" };
  }

  return { processCode: "P", operationType: "PLOTTER" };
}

function normalizeControlLogRow(
  row: WorksheetRow,
  sheetName: string,
  itemIdsByNaturalKey: Map<string, string>,
): RawSeguimientoLog | null {
  const values = Object.values(row);
  const isReposicion = /reposicion/i.test(sheetName);

  const orderCode = normalizeOrderCode(String(values[0] ?? ""));
  const designNumber = parseInteger(isReposicion ? values[3] : values[1]);
  const detail = normalizeText(isReposicion ? values[5] ?? values[2] : values[2]);

  if (!orderCode || designNumber === null || !detail) {
    return null;
  }

  const orderItemId = itemIdsByNaturalKey.get(`${orderCode}|${designNumber}`) ?? null;

  if (!orderItemId) {
    return null;
  }

  const process = resolveControlSheetProcess(values, isReposicion);
  const startAt = parseExcelDate(isReposicion ? values[2] : values[6]);
  const endAt = parseExcelDate(isReposicion ? null : values[7]);
  const quantityOp = parseInteger(isReposicion ? values[7] : values[4]);
  const producedQuantity = parseInteger(isReposicion ? values[7] : values[5]);
  const observations = normalizeText(isReposicion ? values[8] : values[9]) || null;
  const repoCheck = isReposicion ? true : parseBoolean(values[10]);

  return rawSeguimientoLogSchema.parse({
    id: buildLogId(row, sheetName, orderItemId),
    order_item_id: orderItemId,
    order_code: orderCode,
    design_name: detail,
    role_area: resolveSeguimientoRoleArea(null, process.operationType as any),
    operation_type: process.operationType as any,
    process_code: process.processCode,
    size: normalizeText(isReposicion ? values[4] : values[3]) || null,
    quantity_op: quantityOp,
    produced_quantity: producedQuantity,
    start_at: startAt,
    end_at: endAt,
    is_complete: parseBoolean(isReposicion ? null : values[8]),
    is_partial: parseBoolean(isReposicion ? true : values[9]),
    observations,
    repo_check: repoCheck,
  });
}

function buildOrderId(row: WorksheetRow) {
  const explicit = normalizeText(pickFirstValue(row, ORDER_ALIASES.explicitId));

  if (/^[0-9a-f]{8}-/i.test(explicit)) {
    return explicit.toLowerCase();
  }

  return makeDeterministicUuid(
    "seguimiento-order",
    [
      normalizeOrderCode(String(pickFirstValue(row, ORDER_ALIASES.orderCode) ?? "")),
      normalizeText(pickFirstValue(row, ORDER_ALIASES.createdAt)),
    ].join("|"),
  );
}

function buildItemId(row: WorksheetRow) {
  const explicit = normalizeText(pickFirstValue(row, ITEM_ALIASES.explicitId));

  if (/^[0-9a-f]{8}-/i.test(explicit)) {
    return explicit.toLowerCase();
  }

  return makeDeterministicUuid(
    "seguimiento-item",
    [
      normalizeOrderCode(String(pickFirstValue(row, ITEM_ALIASES.orderCode) ?? "")),
      String(parseInteger(pickFirstValue(row, ITEM_ALIASES.designNumber)) ?? 0),
      normalizeText(pickFirstValue(row, ITEM_ALIASES.name)),
      normalizeText(pickFirstValue(row, ITEM_ALIASES.garmentType)),
    ].join("|"),
  );
}

function buildPackagingId(row: WorksheetRow, itemId: string) {
  const explicit = normalizeText(pickFirstValue(row, PACKAGING_ALIASES.explicitId));

  if (/^[0-9a-f]{8}-/i.test(explicit)) {
    return explicit.toLowerCase();
  }

  return makeDeterministicUuid(
    "seguimiento-packaging",
    [
      itemId,
      normalizeText(pickFirstValue(row, PACKAGING_ALIASES.size)),
      String(parseInteger(pickFirstValue(row, PACKAGING_ALIASES.quantity)) ?? 0),
    ].join("|"),
  );
}

function buildLogId(row: WorksheetRow, sheetName: string, itemId: string) {
  const explicit = normalizeText(pickFirstValue(row, LOG_ALIASES.explicitId));

  if (/^[0-9a-f]{8}-/i.test(explicit)) {
    return explicit.toLowerCase();
  }

  return makeDeterministicUuid(
    "seguimiento-log",
    [
      sheetName,
      itemId,
      normalizeOrderCode(String(pickFirstValue(row, LOG_ALIASES.orderCode) ?? "")),
      normalizeText(pickFirstValue(row, LOG_ALIASES.designName)),
      normalizeText(pickFirstValue(row, LOG_ALIASES.operationType)),
      normalizeText(pickFirstValue(row, LOG_ALIASES.startAt)),
    ].join("|"),
  );
}

function normalizeOrderRow(row: WorksheetRow): RawSeguimientoOrder | null {
  const orderCode = normalizeOrderCode(
    String(pickFirstValue(row, ORDER_ALIASES.orderCode) ?? ""),
  );

  if (!orderCode) {
    return null;
  }

  return rawSeguimientoOrderSchema.parse({
    id: buildOrderId(row),
    order_code: orderCode,
    created_at: parseExcelDate(pickFirstValue(row, ORDER_ALIASES.createdAt)),
    delivery_date: parseExcelDate(pickFirstValue(row, ORDER_ALIASES.deliveryDate)),
    kind: normalizeText(pickFirstValue(row, ORDER_ALIASES.kind)) || null,
    status: normalizeText(pickFirstValue(row, ORDER_ALIASES.status)) || null,
    total: parseAmount(pickFirstValue(row, ORDER_ALIASES.total)),
    currency: normalizeText(pickFirstValue(row, ORDER_ALIASES.currency)) || null,
  });
}

function normalizeOrderItemRow(
  row: WorksheetRow,
  orderIdsByCode: Map<string, string>,
): RawSeguimientoOrderItem | null {
  const orderCode = normalizeOrderCode(
    String(pickFirstValue(row, ITEM_ALIASES.orderCode) ?? ""),
  );

  if (!orderCode) {
    return null;
  }

  const designNumber = parseInteger(pickFirstValue(row, ITEM_ALIASES.designNumber));

  if (designNumber === null) {
    return null;
  }

  const explicitOrderId = normalizeText(pickFirstValue(row, ITEM_ALIASES.orderIdRef));
  const orderIdRef = /^[0-9a-f]{8}-/i.test(explicitOrderId)
    ? explicitOrderId.toLowerCase()
    : orderIdsByCode.get(orderCode) ?? null;

  return rawSeguimientoOrderItemSchema.parse({
    id: buildItemId(row),
    order_id_ref: orderIdRef,
    order_code_ref: orderCode,
    diseno_numero: designNumber,
    name: normalizeText(pickFirstValue(row, ITEM_ALIASES.name)) || null,
    garment_type: normalizeText(pickFirstValue(row, ITEM_ALIASES.garmentType)) || null,
    fabric: normalizeText(pickFirstValue(row, ITEM_ALIASES.fabric)) || null,
    gender: normalizeText(pickFirstValue(row, ITEM_ALIASES.gender)) || null,
    quantity: Math.max(0, parseInteger(pickFirstValue(row, ITEM_ALIASES.quantity)) ?? 0),
    estimated_lead_days: parseInteger(pickFirstValue(row, ITEM_ALIASES.estimatedLeadDays)),
    status: normalizeText(pickFirstValue(row, ITEM_ALIASES.status)) || null,
  });
}

function normalizePackagingRow(
  row: WorksheetRow,
  itemIdsByNaturalKey: Map<string, string>,
): RawSeguimientoPackaging | null {
  const explicitItemId = normalizeText(pickFirstValue(row, PACKAGING_ALIASES.orderItemId));
  const orderCode = normalizeOrderCode(
    String(pickFirstValue(row, PACKAGING_ALIASES.orderCode) ?? ""),
  );
  const designNumber = parseInteger(pickFirstValue(row, PACKAGING_ALIASES.designNumber));
  const size = normalizeText(pickFirstValue(row, PACKAGING_ALIASES.size)) || null;
  const quantity = parseInteger(pickFirstValue(row, PACKAGING_ALIASES.quantity));

  const naturalKey = [orderCode, String(designNumber ?? 0)].join("|");
  const itemId = /^[0-9a-f]{8}-/i.test(explicitItemId)
    ? explicitItemId.toLowerCase()
    : itemIdsByNaturalKey.get(naturalKey) ?? null;

  if (!itemId) {
    return null;
  }

  return rawSeguimientoPackagingSchema.parse({
    id: buildPackagingId(row, itemId),
    order_item_id: itemId,
    size,
    quantity,
    mode: normalizeText(pickFirstValue(row, PACKAGING_ALIASES.mode)) || null,
  });
}

function normalizeLogRow(
  row: WorksheetRow,
  sheetName: string,
  itemIdsByNaturalKey: Map<string, string>,
): RawSeguimientoLog | null {
  if (/(formato control produccion|formato control reposicion)/i.test(sheetName)) {
    return normalizeControlLogRow(row, sheetName, itemIdsByNaturalKey);
  }

  const orderCode = normalizeOrderCode(
    String(pickFirstValue(row, LOG_ALIASES.orderCode) ?? ""),
  );
  const explicitItemId = normalizeText(pickFirstValue(row, LOG_ALIASES.orderItemId));
  const designNumber = parseInteger(pickFirstValue(row, ITEM_ALIASES.designNumber));
  const naturalKey = [orderCode, String(designNumber ?? 0)].join("|");
  const orderItemId = /^[0-9a-f]{8}-/i.test(explicitItemId)
    ? explicitItemId.toLowerCase()
    : itemIdsByNaturalKey.get(naturalKey) ?? null;

  if (!orderCode || !orderItemId) {
    return null;
  }

  const operationType = resolveSeguimientoOperationType(
    pickFirstValue(row, LOG_ALIASES.operationType),
    sheetName,
  );
  const designName = normalizeText(pickFirstValue(row, LOG_ALIASES.designName));

  if (!designName) {
    return null;
  }

  return rawSeguimientoLogSchema.parse({
    id: buildLogId(row, sheetName, orderItemId),
    order_item_id: orderItemId,
    order_code: orderCode,
    design_name: designName,
    role_area: resolveSeguimientoRoleArea(
      pickFirstValue(row, LOG_ALIASES.roleArea),
      operationType,
    ),
    operation_type: operationType,
    process_code: resolveSeguimientoProcessCode(
      pickFirstValue(row, LOG_ALIASES.processCode),
    ),
    size: normalizeText(pickFirstValue(row, LOG_ALIASES.size)) || null,
    quantity_op: parseInteger(pickFirstValue(row, LOG_ALIASES.quantityOp)),
    produced_quantity: parseInteger(pickFirstValue(row, LOG_ALIASES.producedQuantity)),
    start_at: parseExcelDate(pickFirstValue(row, LOG_ALIASES.startAt)),
    end_at: parseExcelDate(pickFirstValue(row, LOG_ALIASES.endAt)),
    is_complete: parseBoolean(pickFirstValue(row, LOG_ALIASES.isComplete)),
    is_partial: parseBoolean(pickFirstValue(row, LOG_ALIASES.isPartial)),
    observations: normalizeText(pickFirstValue(row, LOG_ALIASES.observations)) || null,
    repo_check: parseBoolean(pickFirstValue(row, LOG_ALIASES.repoCheck)),
  });
}

function buildProgramacionProcessLogId(
  row: WorksheetRow,
  orderItemId: string,
  operationType: ProgramacionProcessConfig["operationType"],
  startAt: string | null,
) {
  return makeDeterministicUuid(
    "seguimiento-programacion-log",
    [
      orderItemId,
      operationType,
      normalizeText(pickFirstValue(row, ITEM_ALIASES.orderCode)),
      normalizeText(pickFirstValue(row, ITEM_ALIASES.designNumber)),
      startAt ?? "",
      normalizeText(pickFirstValue(row, ITEM_ALIASES.name)),
    ].join("|"),
  );
}

function parseProgramacionProcessState(rawValue: unknown) {
  const normalized = normalizeText(rawValue).toUpperCase();
  if (!normalized) {
    return { isComplete: null, isPartial: null };
  }

  if (normalized.includes("PARCIAL")) {
    return { isComplete: false, isPartial: true };
  }

  if (normalized.includes("COMPLETO") || normalized.includes("FINAL")) {
    return { isComplete: true, isPartial: false };
  }

  return { isComplete: null, isPartial: null };
}

function normalizeProgramacionSize(rawValue: unknown) {
  const text = normalizeText(rawValue) || null;
  if (!text) {
    return { size: null as string | null, displacedDate: null as string | null };
  }

  const looksLikeDate = /GMT|\b\d{4}-\d{2}-\d{2}\b|\b[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4}\b/.test(text);
  if (looksLikeDate) {
    return {
      size: null,
      displacedDate: parseExcelDate(rawValue),
    };
  }

  return {
    size: text.slice(0, 40),
    displacedDate: null,
  };
}

function normalizeProgramacionLogs(
  rows: WorksheetRow[],
  itemIdsByNaturalKey: Map<string, string>,
): RawSeguimientoLog[] {
  const logs: RawSeguimientoLog[] = [];

  for (const row of rows) {
    const orderCode = normalizeOrderCode(
      String(pickFirstValue(row, ITEM_ALIASES.orderCode) ?? ""),
    );
    const designNumber = parseInteger(pickFirstValue(row, ITEM_ALIASES.designNumber));
    const designName = normalizeText(pickFirstValue(row, ITEM_ALIASES.name));
    if (!orderCode || designNumber === null || !designName) {
      continue;
    }

    const orderItemId = itemIdsByNaturalKey.get(`${orderCode}|${designNumber}`) ?? null;
    if (!orderItemId) {
      continue;
    }

    const baseQuantity = parseInteger(pickFirstValue(row, PROGRAMACION_ALIASES.quantity));
    const normalizedSize = normalizeProgramacionSize(
      pickFirstValue(row, PROGRAMACION_ALIASES.size),
    );
    const observations = normalizeText(pickFirstValue(row, PROGRAMACION_ALIASES.observations)) || null;

    for (const config of PROGRAMACION_PROCESS_CONFIGS) {
      const startAt =
        parseExcelDate(pickFirstValue(row, config.startAlias)) ?? normalizedSize.displacedDate;
      const endAt = parseExcelDate(pickFirstValue(row, config.endAlias));
      const responsible = normalizeText(pickFirstValue(row, config.roleAlias)) || null;
      const quantityOp = parseInteger(
        config.quantityAlias
          ? pickFirstValue(row, config.quantityAlias)
          : pickFirstValue(row, PROGRAMACION_ALIASES.quantity),
      );
      const state = parseProgramacionProcessState(
        config.partialAlias ? pickFirstValue(row, config.partialAlias) : endAt ? "COMPLETO" : null,
      );

      if (!startAt && !endAt && !responsible && quantityOp === null) {
        continue;
      }

      logs.push(
        rawSeguimientoLogSchema.parse({
          id: buildProgramacionProcessLogId(row, orderItemId, config.operationType, startAt),
          order_item_id: orderItemId,
          order_code: orderCode,
          design_name: designName,
          role_area: resolveSeguimientoRoleArea(responsible, config.operationType),
          operation_type: config.operationType,
          process_code:
            config.operationType === "SUBLIMACION"
              ? "S"
              : config.operationType === "CORTE_MANUAL"
                ? "C"
                : "P",
          size: normalizedSize.size,
          quantity_op: quantityOp ?? baseQuantity,
          produced_quantity: quantityOp ?? baseQuantity,
          start_at: startAt,
          end_at: endAt,
          is_complete: state.isComplete ?? Boolean(endAt),
          is_partial: state.isPartial,
          observations,
          repo_check: false,
        }),
      );
    }
  }

  return dedupeById(logs);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const selection = inferSheetSelection(options.file, options);

  const programacionRows = selection.programacionSheets.flatMap((sheetName) =>
    readWorksheetRows(options.file, sheetName),
  );
  const orderRows = programacionRows.length > 0
    ? programacionRows
    : readWorksheetRows(options.file, selection.ordersSheet);
  const orders = dedupeById(orderRows
    .map((row) => normalizeOrderRow(row))
    .filter((row): row is RawSeguimientoOrder => row !== null));
  const orderIdsByCode = new Map(orders.map((row) => [row.order_code, row.id]));

  const itemRows = programacionRows.length > 0
    ? programacionRows
    : readWorksheetRows(options.file, selection.itemsSheet);
  const orderItems = dedupeById(itemRows
    .map((row) => normalizeOrderItemRow(row, orderIdsByCode))
    .filter((row): row is RawSeguimientoOrderItem => row !== null));
  const itemIdsByNaturalKey = new Map(
    orderItems.map((row) => [`${row.order_code_ref}|${row.diseno_numero}`, row.id]),
  );

  const packagingRows = selection.packagingSheet
    ? readWorksheetRows(options.file, selection.packagingSheet)
    : [];
  const packaging = packagingRows
    .map((row) => normalizePackagingRow(row, itemIdsByNaturalKey))
    .filter((row): row is RawSeguimientoPackaging => row !== null);

  const logsBySheet = selection.logsSheets.map((sheetName) => {
    const rows = readWorksheetRows(options.file, sheetName);
    const normalized = rows
      .map((row) => normalizeLogRow(row, sheetName, itemIdsByNaturalKey))
      .filter((row): row is RawSeguimientoLog => row !== null);

    return {
      sheetName,
      rows,
      normalized,
    };
  });

  const programacionLogs = normalizeProgramacionLogs(orderRows, itemIdsByNaturalKey);
  const logs = dedupeById([
    ...programacionLogs,
    ...logsBySheet.flatMap((sheet) => sheet.normalized),
  ]);

  const summary = {
    mode: options.dryRun ? "DRY_RUN" : "APPLY",
    file: path.resolve(options.file),
    sheets: selection.sheetNames,
    selected: {
      ordersSheet: selection.ordersSheet,
      itemsSheet: selection.itemsSheet,
      programacionSheets: selection.programacionSheets,
      packagingSheet: selection.packagingSheet,
      logsSheets: selection.logsSheets,
    },
    rows: {
      orders: orders.length,
      orderItems: orderItems.length,
      packaging: packaging.length,
      logs: logs.length,
    },
    skipped: {
      orders: orderRows.length - orders.length,
      orderItems: itemRows.length - orderItems.length,
      packaging: packagingRows.length - packaging.length,
      logs: logsBySheet.reduce(
        (total, sheet) => total + (sheet.rows.length - sheet.normalized.length),
        0,
      ),
    },
    detectedHeaders: {
      orders: orderRows[0]
        ? Object.keys(orderRows[0]).map((value) => normalizeHeaderKey(value))
        : [],
      orderItems: itemRows[0]
        ? Object.keys(itemRows[0]).map((value) => normalizeHeaderKey(value))
        : [],
      packaging: packagingRows[0]
        ? Object.keys(packagingRows[0]).map((value) => normalizeHeaderKey(value))
        : [],
      logs: Object.fromEntries(
        logsBySheet.map((sheet) => [
          sheet.sheetName,
          sheet.rows[0]
            ? Object.keys(sheet.rows[0]).map((value) => normalizeHeaderKey(value))
            : [],
        ]),
      ),
    },
  };

  if (!options.dryRun) {
    await mkdir(options.outDir, { recursive: true });
    await writeFile(
      path.join(options.outDir, `${options.base}.orders.json`),
      JSON.stringify(orders, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(options.outDir, `${options.base}.order_items.json`),
      JSON.stringify(orderItems, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(options.outDir, `${options.base}.packaging.json`),
      JSON.stringify(packaging, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(options.outDir, `${options.base}.logs.json`),
      JSON.stringify(logs, null, 2),
      "utf8",
    );
  }

  console.log(JSON.stringify(summary, null, 2));
}

void main();