import assert from "node:assert/strict";
import test from "node:test";

import {
  makeDeterministicUuid,
  normalizeHeaderKey,
  normalizeOrderCode,
  parseAmount,
  parseBoolean,
  parseInteger,
} from "@/src/imports/historical-excel/helpers";

test("historical excel helpers: normaliza orderCode heredado", () => {
  assert.equal(normalizeOrderCode("vn123"), "VN - 123");
  assert.equal(normalizeOrderCode(" VT - 77 "), "VT - 77");
});

test("historical excel helpers: normaliza headers con acentos y espacios", () => {
  assert.equal(normalizeHeaderKey("Número factura"), "numero_factura");
  assert.equal(normalizeHeaderKey("  Área destino  "), "area_destino");
});

test("historical excel helpers: parsea montos, enteros y booleanos", () => {
  assert.equal(parseAmount("$ 1.234,50"), "1234.50");
  assert.equal(parseInteger(" 42 und "), 42);
  assert.equal(parseBoolean("Sí"), true);
  assert.equal(parseBoolean("no"), false);
});

test("historical excel helpers: genera uuids deterministas", () => {
  const first = makeDeterministicUuid("envio", "VN - 123|2026-04-01");
  const second = makeDeterministicUuid("envio", "VN - 123|2026-04-01");
  assert.equal(first, second);
});