import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  warehouseTransferActionSchema,
  warehouseTransferCreateSchema,
  warehouseTransferDeleteSchema,
  warehouseTransferListQuerySchema,
} from "@/src/utils/warehouse-transfers-contract";

test("warehouse-transfers contrato: valida creacion base", () => {
  const parsed = warehouseTransferCreateSchema.safeParse({
    inventoryItemId: "item-1",
    variantId: "variant-1",
    fromWarehouseId: "wh-1",
    toWarehouseId: "wh-2",
    quantity: "4",
  });

  assert.equal(parsed.success, true);
});

test("warehouse-transfers contrato: rechaza bodega origen y destino iguales", () => {
  const parsed = warehouseTransferCreateSchema.safeParse({
    inventoryItemId: "item-1",
    variantId: "variant-1",
    fromWarehouseId: "wh-1",
    toWarehouseId: "wh-1",
    quantity: 3,
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(parsed.error, "Los datos del traslado son inválidos.");
  assertStatus(response.status, 400);
});

test("warehouse-transfers contrato: valida query de listado", () => {
  const parsed = warehouseTransferListQuerySchema.safeParse({
    warehouseId: "wh-1",
    scope: "outgoing",
    status: "resolved",
  });

  assert.equal(parsed.success, true);
});

test("warehouse-transfers contrato: valida payload de acciones", () => {
  assert.equal(warehouseTransferActionSchema.safeParse({ id: "tx-1" }).success, true);
  assert.equal(warehouseTransferDeleteSchema.safeParse({ id: "tx-1" }).success, true);
});

test("warehouse-transfers contrato: envelope estable para conflicto de stock", async () => {
  const response = jsonError(422, "INSUFFICIENT_STOCK", "Stock insuficiente en bodega origen", {
    quantity: ["La cantidad excede el disponible en bodega origen."],
  });

  assertStatus(response.status, 422);

  const payload = await response.json();
  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "INSUFFICIENT_STOCK");
  assertFieldError(payload, "quantity", "excede");
});
