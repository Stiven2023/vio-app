import assert from "node:assert/strict";
import test from "node:test";

import {
  accountingEntriesBySourceQuerySchema,
  accountingEntrySourceByIdParamsSchema,
  orderByPaymentParamsSchema,
  orderHistoryParamsSchema,
} from "@/src/utils/accounting-traceability-contract";
import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { zodFirstErrorEnvelope } from "@/src/utils/api-error";

test("traceability contract: order history exige id uuid", async () => {
  const parsed = orderHistoryParamsSchema.safeParse({ id: "order-1" });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Los parámetros del pedido son inválidos.",
  );

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assertFieldError(payload, "id");
});

test("traceability contract: source by id exige id uuid", async () => {
  const parsed = accountingEntrySourceByIdParamsSchema.safeParse({ id: "entry-1" });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Los parámetros del asiento son inválidos.",
  );

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assertFieldError(payload, "id");
});

test("traceability contract: by-payment exige paymentId uuid", async () => {
  const parsed = orderByPaymentParamsSchema.safeParse({ paymentId: "pay-1" });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Los parámetros del pago son inválidos.",
  );

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assertFieldError(payload, "paymentId");
});

test("traceability contract: source query acepta status permitido", () => {
  const parsed = accountingEntriesBySourceQuerySchema.safeParse({
    sourceType: "order_payment",
    sourceId: "source-uuid",
    status: "posted",
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  assert.equal(parsed.data.sourceType, "ORDER_PAYMENT");
  assert.equal(parsed.data.status, "POSTED");
});

test("traceability contract: source query rechaza status inválido", async () => {
  const parsed = accountingEntriesBySourceQuerySchema.safeParse({
    sourceType: "ORDER_PAYMENT",
    sourceId: "source-uuid",
    status: "PENDING",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Parámetros de origen inválidos.",
  );

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assertFieldError(payload, "status");
});
