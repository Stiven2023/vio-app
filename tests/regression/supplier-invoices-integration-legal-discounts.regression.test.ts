import assert from "node:assert/strict";
import test from "node:test";

import { calculateLegalDiscounts } from "@/src/utils/legal-discounts";

test("supplier-invoice motor: pequeño cliente PURCHASE", () => {
  const subtotal = 1000000;
  const legalDiscounts = calculateLegalDiscounts({
    subtotal,
    ivaRate: 19,
    operationType: "PURCHASE",
    customerProfile: "SMALL_CUSTOMER",
    reteIcaRate: 0.966,
    reteIvaRate: 15,
    stampRate: 1.5,
    contractRequiresStamps: false,
  });

  assert.strictEqual(legalDiscounts.discounts.reteFuente, "0.00");
  assert.strictEqual(legalDiscounts.discounts.reteIca, "0.00");
  assert.strictEqual(legalDiscounts.discounts.reteIva, "0.00");
  assert.strictEqual(legalDiscounts.ivaAmount, "190000.00");
  assert.strictEqual(legalDiscounts.totalPayable, "1190000.00");
});

test("supplier-invoice motor: agente retenedor PURCHASE", () => {
  const subtotal = 1000000;
  const legalDiscounts = calculateLegalDiscounts({
    subtotal,
    ivaRate: 19,
    operationType: "PURCHASE",
    customerProfile: "WITHHOLDING_AGENT",
    reteIcaRate: 0.966,
    reteIvaRate: 15,
    stampRate: 1.5,
    contractRequiresStamps: false,
  });

  assert.strictEqual(legalDiscounts.discounts.reteFuente, "25000.00");
  assert.strictEqual(legalDiscounts.discounts.reteIva, "0.00");

  // ReteIca: 0.966% de subtotal ~9,660
  const expectedReteIca = (subtotal * 0.00966).toFixed(2);
  const actualReteIca = Number(legalDiscounts.discounts.reteIca).toFixed(2);
  assert.strictEqual(actualReteIca, expectedReteIca);
});

test("supplier-invoice motor: gran contribuyente SERVICE", () => {
  const subtotal = 5000000;
  const legalDiscounts = calculateLegalDiscounts({
    subtotal,
    ivaRate: 19,
    operationType: "SERVICE",
    customerProfile: "LARGE_CONTRIBUTOR",
    reteIcaRate: 0.966,
    reteIvaRate: 15,
    stampRate: 1.5,
    contractRequiresStamps: false,
  });

  assert.strictEqual(legalDiscounts.discounts.reteFuente, "200000.00");

  const expectedReteIca = (subtotal * 0.00966).toFixed(2);
  const actualReteIca = Number(legalDiscounts.discounts.reteIca).toFixed(2);
  assert.strictEqual(actualReteIca, expectedReteIca);

  const ivaAmount = Number(legalDiscounts.ivaAmount);
  const expectedReteIva = (ivaAmount * 0.15).toFixed(2);
  const actualReteIva = Number(legalDiscounts.discounts.reteIva).toFixed(2);
  assert.strictEqual(actualReteIva, expectedReteIva);
});

test("supplier-invoice motor: entidad pública estampillas", () => {
  const subtotal = 2000000;
  const legalDiscounts = calculateLegalDiscounts({
    subtotal,
    ivaRate: 19,
    operationType: "FEE",
    customerProfile: "PUBLIC_ENTITY",
    reteIcaRate: 0.966,
    reteIvaRate: 15,
    stampRate: 1.5,
    contractRequiresStamps: true,
  });

  assert.strictEqual(legalDiscounts.discounts.reteFuente, "0.00");
  assert.strictEqual(legalDiscounts.discounts.reteIca, "0.00");
  assert.strictEqual(legalDiscounts.discounts.reteIva, "0.00");

  const expectedStamps = ((subtotal + Number(legalDiscounts.ivaAmount)) * 0.015).toFixed(2);
  const actualStamps = Number(legalDiscounts.discounts.stamps).toFixed(2);
  assert.strictEqual(actualStamps, expectedStamps);
});
