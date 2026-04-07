import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { z } from "zod";

// Replicates the Zod schema from the factoring status endpoint
const factoringStatusUpdateSchema = z.object({
  status: z.enum(["COLLECTED", "VOIDED"]),
  collectionDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD.")
    .optional(),
});

test("factoring status: acepta COLLECTED sin fecha (usa fecha del día)", () => {
  const parsed = factoringStatusUpdateSchema.safeParse({ status: "COLLECTED" });

  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  assert.equal(parsed.data.status, "COLLECTED");
  assert.equal(parsed.data.collectionDate, undefined);
});

test("factoring status: acepta VOIDED sin fecha", () => {
  const parsed = factoringStatusUpdateSchema.safeParse({ status: "VOIDED" });

  assert.equal(parsed.success, true);
});

test("factoring status: acepta COLLECTED con fecha válida", () => {
  const parsed = factoringStatusUpdateSchema.safeParse({
    status: "COLLECTED",
    collectionDate: "2026-04-07",
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  assert.equal(parsed.data.collectionDate, "2026-04-07");
});

test("factoring status: rechaza status inválido", async () => {
  const parsed = factoringStatusUpdateSchema.safeParse({ status: "ACTIVE" });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Los datos del estado son inválidos.",
  );

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assertFieldError(payload, "status");
});

test("factoring status: rechaza fecha con formato incorrecto", async () => {
  const parsed = factoringStatusUpdateSchema.safeParse({
    status: "COLLECTED",
    collectionDate: "07-04-2026", // formato incorrecto
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Los datos del estado son inválidos.",
  );

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assertFieldError(payload, "collectionDate");
});

test("factoring status: código estable para transición inválida de estado", async () => {
  const response = jsonError(
    409,
    "FACTORING_INVALID_STATE_TRANSITION",
    "El registro ya tiene estado COLLECTED y no puede actualizarse.",
    {
      status: ["Solo se pueden actualizar registros con estado ACTIVE."],
    },
  );

  assertStatus(response.status, 409);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "FACTORING_INVALID_STATE_TRANSITION");
  assertFieldError(payload, "status");
});

test("factoring status: código estable para config contable faltante", async () => {
  const response = jsonError(
    409,
    "ACCOUNTING_CONFIGURATION_MISSING",
    "Falta configuración contable para registrar el factoring.",
    {
      accounting: ["Configura las cuentas antes de cobrar el factoring."],
    },
  );

  assertStatus(response.status, 409);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "ACCOUNTING_CONFIGURATION_MISSING");
  assertFieldError(payload, "accounting");
});

test("factoring status: NOT_FOUND estable para registro inexistente", async () => {
  const response = jsonError(404, "NOT_FOUND", "Registro de factoring no encontrado.");

  assertStatus(response.status, 404);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "NOT_FOUND");
});
