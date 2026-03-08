"use client";

import * as XLSX from "xlsx";

function normalizeKey(k: string) {
  return String(k ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getCell(row: Record<string, any>, keys: string[]) {
  const keyMap = new Map<string, any>();

  Object.keys(row ?? {}).forEach((k) => keyMap.set(normalizeKey(k), row[k]));

  for (const k of keys) {
    const v = keyMap.get(normalizeKey(k));

    if (v !== undefined) return v;
  }

  return undefined;
}

function asString(v: unknown) {
  const s = String(v ?? "").trim();

  return s;
}

function asPositiveInt(v: unknown) {
  const n = Number(String(v ?? ""));

  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);

  return i > 0 ? i : null;
}

export async function readExcelFirstSheetRows(file: File): Promise<any[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const first = wb.SheetNames?.[0];

  if (!first) return [];

  const sheet = wb.Sheets[first];

  if (!sheet) return [];

  return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as any[];
}

export function parseIndividualPackagingFromRows(rows: any[]) {
  const out: Array<{
    personName: string;
    personNumber: string | null;
    size: string;
    quantity: number;
  }> = [];

  for (const r of rows ?? []) {
    const personName = asString(getCell(r, ["nombre", "name", "persona"]))
      .trim()
      .replace(/\s+/g, " ");
    const personNumberRaw = asString(
      getCell(r, ["numero", "número", "number", "documento", "doc"]),
    );
    const size = asString(getCell(r, ["talla", "size"]))
      .trim()
      .replace(/\s+/g, " ");

    const quantity =
      asPositiveInt(getCell(r, ["cantidad", "qty", "quantity"])) ?? 1;

    if (!personName && !size) continue;

    out.push({
      personName: personName || "-",
      personNumber: personNumberRaw ? personNumberRaw : null,
      size: size || "",
      quantity,
    });
  }

  return out;
}

export function parseSocksFromRows(rows: any[]) {
  const out: Array<{
    size: string;
    quantity: number;
    description: string | null;
    imageUrl: string | null;
  }> = [];

  for (const r of rows ?? []) {
    const size = asString(getCell(r, ["talla", "size"]))
      .trim()
      .replace(/\s+/g, " ");
    const quantity = asPositiveInt(getCell(r, ["cantidad", "qty", "quantity"]));
    const description = asString(getCell(r, ["descripcion", "descripción", "description"]))
      .trim()
      .replace(/\s+/g, " ");
    const imageUrl = asString(getCell(r, ["imagen", "image", "imageurl", "image_url", "url"]))
      .trim();

    if (!size && !quantity && !description) continue;
    if (!quantity) continue;

    out.push({
      size: size || "",
      quantity,
      description: description ? description : null,
      imageUrl: imageUrl ? imageUrl : null,
    });
  }

  return out;
}
