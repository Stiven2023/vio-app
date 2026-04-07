import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  inventoryOutputDeleteSchema,
  inventoryOutputMutationSchema,
  inventoryOutputUpdateSchema,
} from "@/src/utils/inventory-outputs-contract";

test("inventory-outputs contrato: valida payload base", () => {
  const parsed = inventoryOutputMutationSchema.safeParse({
    inventoryItemId: "item-1",
    variantId: "variant-1",
    warehouseId: "wh-1",
    quantity: "2",
    reason: "venta parcial",
  });

  assert.equal(parsed.success, true);
});

test("inventory-outputs contrato: rechaza reason vacio", () => {
  const parsed = inventoryOutputMutationSchema.safeParse({
    inventoryItemId: "item-1",
    variantId: "variant-1",
    warehouseId: "wh-1",
    quantity: 2,
    reason: "",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(parsed.error, "Los datos de salida de inventario son inválidos.");
  assertStatus(response.status, 400);
});

test("inventory-outputs contrato: valida update y delete con id", () => {
  assert.equal(
    inventoryOutputUpdateSchema.safeParse({
      id: "out-1",
      inventoryItemId: "item-1",
      variantId: "variant-1",
      warehouseId: "wh-1",
      quantity: 2,
      reason: "venta",
    }).success,
    true,
  );

  assert.equal(inventoryOutputDeleteSchema.safeParse({ id: "out-1" }).success, true);
});

test("inventory-outputs contrato: envelope estable para stock insuficiente", async () => {
  const response = jsonError(422, "INSUFFICIENT_STOCK", "Stock insuficiente", {
    quantity: ["La cantidad excede el disponible."],
  });

  assertStatus(response.status, 422);

  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "INSUFFICIENT_STOCK");
  assertFieldError(payload, "quantity", "excede");
});
