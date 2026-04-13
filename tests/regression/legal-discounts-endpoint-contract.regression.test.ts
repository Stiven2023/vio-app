import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { legalDiscountsPreviewBodySchema } from "@/src/utils/legal-discounts-contract";

test("legal discounts preview: acepta payload valido", () => {
  const parsed = legalDiscountsPreviewBodySchema.safeParse({
    subtotal: 1550000,
    ivaRate: 19,
    operationType: "SERVICE",
    customerProfile: "LARGE_CONTRIBUTOR",
    reteIcaRate: 0.966,
    reteIvaRate: 15,
    stampRate: 1.5,
    contractRequiresStamps: true,
  });

  assert.equal(parsed.success, true);
});

test("legal discounts preview: rechaza subtotal negativo con envelope estable", async () => {
  const parsed = legalDiscountsPreviewBodySchema.safeParse({
    subtotal: -1,
    ivaRate: 19,
    operationType: "SERVICE",
    customerProfile: "SMALL_CUSTOMER",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Datos invalidos para calcular descuentos legales.",
  );

  assertStatus(response.status, 400);

  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assertFieldError(payload, "subtotal", "negativo");
});

test("legal discounts preview: rechaza operationType invalido", async () => {
  const parsed = legalDiscountsPreviewBodySchema.safeParse({
    subtotal: 100000,
    ivaRate: 19,
    operationType: "INVALID",
    customerProfile: "SMALL_CUSTOMER",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Datos invalidos para calcular descuentos legales.",
  );
  const payload = await response.json();

  assertStatus(response.status, 400);
  assertErrorEnvelopeShape(payload);
  assertFieldError(payload, "operationType");
});
