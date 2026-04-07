import assert from "node:assert/strict";
import test from "node:test";

import {
  HIGH_AMOUNT_THRESHOLD_COP,
  requiresDoubleApproval,
} from "@/src/utils/financial-guards";
import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { jsonError } from "@/src/utils/api-error";

// ─── requiresDoubleApproval ──────────────────────────────────────────────────

test("financial guards: montos por debajo del umbral NO requieren doble aprobación", () => {
  assert.equal(requiresDoubleApproval(0), false);
  assert.equal(requiresDoubleApproval(100_000), false);
  assert.equal(requiresDoubleApproval(4_999_999), false);
  assert.equal(requiresDoubleApproval(HIGH_AMOUNT_THRESHOLD_COP - 1), false);
});

test("financial guards: montos iguales o superiores al umbral SÍ requieren doble aprobación", () => {
  assert.equal(requiresDoubleApproval(HIGH_AMOUNT_THRESHOLD_COP), true);
  assert.equal(requiresDoubleApproval(HIGH_AMOUNT_THRESHOLD_COP + 1), true);
  assert.equal(requiresDoubleApproval(10_000_000), true);
  assert.equal(requiresDoubleApproval(100_000_000), true);
});

test("financial guards: valores no finitos siempre retornan false", () => {
  assert.equal(requiresDoubleApproval(NaN), false);
  assert.equal(requiresDoubleApproval(Infinity), false);
  assert.equal(requiresDoubleApproval(-Infinity), false);
});

test("financial guards: umbral COP es 5 000 000 (5M COP)", () => {
  assert.equal(HIGH_AMOUNT_THRESHOLD_COP, 5_000_000);
});

// ─── CLIENT_LEGALLY_BLOCKED response contract ────────────────────────────────

test("financial guards: código CLIENT_LEGALLY_BLOCKED tiene shape correcta", async () => {
  const response = jsonError(
    409,
    "CLIENT_LEGALLY_BLOCKED",
    "El cliente tiene restricciones legales activas que impiden operaciones financieras.",
    { client: ["Contacta al área jurídica para habilitar al cliente."] },
  );

  assertStatus(response.status, 409);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "CLIENT_LEGALLY_BLOCKED");
  assertFieldError(payload, "client");
});

test("financial guards: código CLIENT_LEGALLY_BLOCKED es estable entre llamadas", async () => {
  const r1 = jsonError(409, "CLIENT_LEGALLY_BLOCKED", "Bloqueado.");
  const r2 = jsonError(409, "CLIENT_LEGALLY_BLOCKED", "Bloqueado por otra razón.");

  const p1 = await r1.json();
  const p2 = await r2.json();

  assert.equal(p1.code, p2.code, "El código debe ser idéntico independientemente del mensaje");
  assert.equal(p1.code, "CLIENT_LEGALLY_BLOCKED");
});
