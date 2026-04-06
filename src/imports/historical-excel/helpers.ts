import { createHash } from "node:crypto";

import * as XLSX from "xlsx";

export type WorksheetRow = Record<string, unknown>;

export function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeHeaderKey(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeOrderCode(value: string | null | undefined): string {
  const text = normalizeText(value).toUpperCase();

  if (!text) {
    return "";
  }

  const match = text.match(/\b(VN|VT|VI|VW|VR|VP)\s*-?\s*(\d+)\b/);
  if (match) {
    return `${match[1]} - ${match[2]}`;
  }

  return text;
}

export function parseAmount(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toFixed(2) : null;
  }

  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/\$/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");
  const amount = Number(normalized);

  return Number.isFinite(amount) ? amount.toFixed(2) : null;
}

export function parseInteger(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value) : null;
  }

  const normalized = String(value).replace(/[^0-9-]/g, "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["si", "sí", "yes", "true", "1", "x", "ok"].includes(normalized)) {
    return true;
  }

  if (["no", "false", "0"].includes(normalized)) {
    return false;
  }

  return null;
}

export function parseExcelDate(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) {
      return null;
    }

    const date = new Date(
      Date.UTC(
        parsed.y,
        Math.max(0, parsed.m - 1),
        parsed.d,
        parsed.H ?? 0,
        parsed.M ?? 0,
        Math.floor(parsed.S ?? 0),
      ),
    );

    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function makeDeterministicUuid(namespace: string, seed: string) {
  const hash = createHash("sha1")
    .update(`${namespace}:${seed}`)
    .digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `5${hash.slice(13, 16)}`,
    `a${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

export function buildNormalizedRowMap(row: WorksheetRow) {
  const normalized = new Map<string, unknown>();

  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeaderKey(key);
    if (!normalizedKey || normalized.has(normalizedKey)) {
      continue;
    }
    normalized.set(normalizedKey, value);
  }

  return normalized;
}

export function pickFirstValue(
  row: WorksheetRow,
  aliases: readonly string[],
): unknown {
  const normalizedRow = buildNormalizedRowMap(row);

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeaderKey(alias);
    if (normalizedRow.has(normalizedAlias)) {
      return normalizedRow.get(normalizedAlias);
    }
  }

  return null;
}

export function readWorksheetRows(
  workbookPath: string,
  sheetName: string,
): WorksheetRow[] {
  const workbook = XLSX.readFile(workbookPath, {
    cellDates: true,
    dense: false,
  });
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(`La hoja ${sheetName} no existe en ${workbookPath}.`);
  }

  return XLSX.utils.sheet_to_json<WorksheetRow>(worksheet, {
    defval: null,
    raw: true,
  });
}

export function listWorkbookSheetNames(workbookPath: string) {
  const workbook = XLSX.readFile(workbookPath, {
    cellDates: true,
    dense: false,
  });

  return workbook.SheetNames;
}