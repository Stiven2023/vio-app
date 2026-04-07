import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  inventoryEntryCreateSchema,
  inventoryEntryDeleteSchema,
  inventoryEntryUpdateSchema,
} from "@/src/utils/inventory-entries-contract";

test("inventory-entries contrato: valida payload base de creacion", () => {
  const parsed = inventoryEntryCreateSchema.safeParse({
    inventoryItemId: "item-1",
    variantId: "variant-1",
    warehouseId: "warehouse-1",
    quantity: "3",
  });

  assert.equal(parsed.success, true);
});

test("inventory-entries contrato: rechaza quantity invalida", () => {
  const parsed = inventoryEntryCreateSchema.safeParse({
    inventoryItemId: "item-1",
    variantId: "variant-1",
    warehouseId: "warehouse-1",
    quantity: 0,
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(parsed.error, "Los datos de entrada de inventario son inválidos.");
  assertStatus(response.status, 400);
});

test("inventory-entries contrato: valida update y delete con id", () => {
  assert.equal(
    inventoryEntryUpdateSchema.safeParse({
      id: "entry-1",
      inventoryItemId: "item-1",
      variantId: "variant-1",
      warehouseId: "warehouse-1",
      quantity: 5,
    }).success,
    true,
  );

  assert.equal(inventoryEntryDeleteSchema.safeParse({ id: "entry-1" }).success, true);
});

test("inventory-entries contrato: envelope estable para item inexistente", async () => {
  const response = jsonError(404, "INVENTORY_ITEM_NOT_FOUND", "inventory item not found", {
    inventoryItemId: ["El inventario no existe."],
  });

  assertStatus(response.status, 404);

  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "INVENTORY_ITEM_NOT_FOUND");
  assertFieldError(payload, "inventoryItemId", "no existe");
});
