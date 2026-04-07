import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { accountsReceivableQuerySchema } from "@/src/utils/accounts-receivable-contract";

test("accounts receivable query: acepta filtros validos", () => {
  const parsed = accountsReceivableQuerySchema.safeParse({
    paymentType: "CREDIT",
    clientId: "11111111-1111-4111-8111-111111111111",
    dateFrom: "2026-01-01",
    dateTo: "2026-01-31",
    agingBucket: "31_60",
    creditBackingType: "PURCHASE_ORDER",
    page: "1",
    pageSize: "15",
  });

  assert.equal(parsed.success, true);
});

test("accounts receivable query: rechaza clientId invalido con envelope estable", async () => {
  const parsed = accountsReceivableQuerySchema.safeParse({
    paymentType: "CREDIT",
    clientId: "all",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(parsed.error, "Los filtros de cartera son invalidos.");

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assertFieldError(payload, "clientId", "invalido");
});

test("accounts receivable query: rechaza rango de fechas invertido", async () => {
  const parsed = accountsReceivableQuerySchema.safeParse({
    dateFrom: "2026-02-01",
    dateTo: "2026-01-01",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(parsed.error, "Los filtros de cartera son invalidos.");
  const payload = await response.json();

  assertStatus(response.status, 400);
  assertErrorEnvelopeShape(payload);
  assertFieldError(payload, "dateTo", "fecha final");
});
