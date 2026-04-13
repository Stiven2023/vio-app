import assert from "node:assert/strict";
import test from "node:test";

import { calculateLegalDiscounts } from "@/src/utils/legal-discounts";

test("legal discounts: cliente pequeno no aplica retenciones", () => {
  const result = calculateLegalDiscounts({
    subtotal: 100000,
    ivaRate: 19,
    operationType: "SERVICE",
    customerProfile: "SMALL_CUSTOMER",
    reteIcaRate: 0.966,
    reteIvaRate: 15,
    stampRate: 1.5,
    contractRequiresStamps: false,
  });

  assert.equal(result.ivaAmount, "19000.00");
  assert.equal(result.discounts.reteFuente, "0.00");
  assert.equal(result.discounts.reteIca, "0.00");
  assert.equal(result.discounts.reteIva, "0.00");
  assert.equal(result.discounts.stamps, "0.00");
  assert.equal(result.totalPayable, "119000.00");
});

test("legal discounts: agente retenedor aplica retefuente + reteica", () => {
  const result = calculateLegalDiscounts({
    subtotal: 100000,
    ivaRate: 19,
    operationType: "PURCHASE",
    customerProfile: "WITHHOLDING_AGENT",
    reteIcaRate: 0.966,
    reteIvaRate: 15,
    stampRate: 1.5,
    contractRequiresStamps: false,
  });

  assert.equal(result.discounts.reteFuente, "2500.00");
  assert.equal(result.discounts.reteIca, "966.00");
  assert.equal(result.discounts.reteIva, "0.00");
  assert.equal(result.discounts.totalLegalDiscounts, "3466.00");
  assert.equal(result.totalPayable, "115534.00");
});

test("legal discounts: gran contribuyente aplica retefuente + reteiva + reteica", () => {
  const result = calculateLegalDiscounts({
    subtotal: 100000,
    ivaRate: 19,
    operationType: "SERVICE",
    customerProfile: "LARGE_CONTRIBUTOR",
    reteIcaRate: 0.966,
    reteIvaRate: 15,
    stampRate: 1.5,
    contractRequiresStamps: false,
  });

  assert.equal(result.discounts.reteFuente, "4000.00");
  assert.equal(result.discounts.reteIca, "966.00");
  assert.equal(result.discounts.reteIva, "2850.00");
  assert.equal(result.discounts.totalLegalDiscounts, "7816.00");
  assert.equal(result.totalPayable, "111184.00");
});

test("legal discounts: entidad publica aplica estampillas por defecto", () => {
  const result = calculateLegalDiscounts({
    subtotal: 100000,
    ivaRate: 19,
    operationType: "SERVICE",
    customerProfile: "PUBLIC_ENTITY",
    reteIcaRate: 0.966,
    reteIvaRate: 15,
    stampRate: 1.5,
    contractRequiresStamps: false,
  });

  // Estampillas: 1.5% de (subtotal + IVA) = 1.5% de 119,000 = 1,785
  assert.equal(result.discounts.stamps, "1785.00");
  assert.equal(result.appliedRules.some((rule) => rule.code === "STAMPS"), true);
});
