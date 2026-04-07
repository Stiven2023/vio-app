import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  normalizeWarehouseCode,
  warehouseIdSchema,
  warehouseMutationSchema,
} from "@/src/utils/warehouses-contract";

test("warehouses contrato: normaliza codigo de bodega", () => {
  assert.equal(normalizeWarehouseCode(" bodega central #1 "), "BODEGA_CENTRAL__1");
});

test("warehouses contrato: valida payload minimo de creacion", () => {
  const parsed = warehouseMutationSchema.safeParse({
    code: "BOD-01",
    name: "Bodega Principal",
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  assert.equal(parsed.data.city, "Medellin");
  assert.equal(parsed.data.department, "ANTIOQUIA");
  assert.equal(parsed.data.isActive, true);
});

test("warehouses contrato: rechaza creacion sin nombre", () => {
  const parsed = warehouseMutationSchema.safeParse({
    code: "BOD-01",
    name: "",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(parsed.error, "Los datos de la bodega son inválidos.");

  assertStatus(response.status, 400);
});

test("warehouses contrato: valida id para operaciones PUT/DELETE", () => {
  const invalid = warehouseIdSchema.safeParse({ id: "" });
  assert.equal(invalid.success, false);

  const valid = warehouseIdSchema.safeParse({ id: "warehouse-123" });
  assert.equal(valid.success, true);
});

test("warehouses contrato: error envelope tiene shape estable", async () => {
  const response = jsonError(409, "WAREHOUSE_STOCK_CONFLICT", "No se puede eliminar.", {
    id: ["Primero elimina o traslada el stock asociado."],
  });

  assertStatus(response.status, 409);

  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assertFieldError(payload, "id", "stock asociado");
  assert.equal(payload.code, "WAREHOUSE_STOCK_CONFLICT");
});
