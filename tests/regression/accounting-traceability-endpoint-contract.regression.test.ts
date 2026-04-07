import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { jsonError, jsonNotFound } from "@/src/utils/api-error";

test("asientos/source: valida sourceType y sourceId requeridos", async () => {
  const response = jsonError(
    400,
    "VALIDATION_ERROR",
    "Debes enviar sourceType y sourceId.",
    {
      sourceType: ["sourceType es obligatorio."],
      sourceId: ["sourceId es obligatorio."],
    },
  );

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assertFieldError(payload, "sourceType");
  assertFieldError(payload, "sourceId");
});

test("asientos/[id]/source: valida id requerido", async () => {
  const response = jsonError(400, "VALIDATION_ERROR", "El asiento es obligatorio.", {
    id: ["Debes indicar el asiento a consultar."],
  });

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assertFieldError(payload, "id");
});

test("orders/[id]/history: usa NOT_FOUND estable cuando el pedido no existe", async () => {
  const response = jsonNotFound("El pedido no existe.");

  assertStatus(response.status, 404);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "NOT_FOUND");
  assert.equal(payload.message, "El pedido no existe.");
});

test("orders/by-payment/[paymentId]: valida paymentId requerido", async () => {
  const response = jsonError(400, "VALIDATION_ERROR", "El pago es obligatorio.", {
    paymentId: ["Debes indicar el pago a consultar."],
  });

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assertFieldError(payload, "paymentId");
});

test("consignaciones/[id]/status: invalid state transition conserva codigo", async () => {
  const response = jsonError(
    409,
    "INVALID_STATE_TRANSITION",
    "El pago ya tiene el estado solicitado.",
  );

  assertStatus(response.status, 409);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "INVALID_STATE_TRANSITION");
});

test("consignaciones/[id]/status: config contable faltante conserva codigo", async () => {
  const response = jsonError(
    409,
    "ACCOUNTING_CONFIGURATION_MISSING",
    "Falta configuracion contable para registrar la consignacion.",
    {
      accounting: ["Configura cuentas contables antes de aprobar la consignacion."],
    },
  );

  assertStatus(response.status, 409);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "ACCOUNTING_CONFIGURATION_MISSING");
  assertFieldError(payload, "accounting");
});