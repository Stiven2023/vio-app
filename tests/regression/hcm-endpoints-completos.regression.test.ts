import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  hcmCartaLaboralCreateSchema,
  hcmCertificados220QuerySchema,
  hcmColillasQuerySchema,
  hcmContabilizarPreAsientosSchema,
  hcmDisponibilidadQuerySchema,
  hcmHoraExtraAprobarBodySchema,
  hcmHorasExtrasListQuerySchema,
  hcmNotificacionesQuerySchema,
} from "@/src/utils/hcm-contract";

test("hcm endpoints completos: query de colillas válida", () => {
  const parsed = hcmColillasQuerySchema.safeParse({
    period: "2026-04",
    status: "PAGADA",
  });

  assert.equal(parsed.success, true);
});

test("hcm endpoints completos: vigencia fiscal inválida en certificados220", () => {
  const parsed = hcmCertificados220QuerySchema.safeParse({
    vigenciaFiscal: "1800",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Parámetros de certificados 220 inválidos.",
  );

  assertStatus(response.status, 400);
});

test("hcm endpoints completos: payload de carta laboral válido", () => {
  const parsed = hcmCartaLaboralCreateSchema.safeParse({
    tipo: "LABORAL_GENERAL",
    destinatario: "Banco de Prueba",
    proposito: "Solicitud de crédito hipotecario",
  });

  assert.equal(parsed.success, true);
});

test("hcm endpoints completos: listado de horas extras rechaza fecha inválida", () => {
  const parsed = hcmHorasExtrasListQuerySchema.safeParse({
    fecha: "2026/04/07",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Parámetros de horas extras inválidos.",
  );

  assertStatus(response.status, 400);
});

test("hcm endpoints completos: query de notificaciones acepta filtro leída", () => {
  const parsed = hcmNotificacionesQuerySchema.safeParse({
    leida: "false",
  });

  assert.equal(parsed.success, true);
});

test("hcm endpoints completos: disponibilidad rechaza fecha con formato incorrecto", () => {
  const parsed = hcmDisponibilidadQuerySchema.safeParse({
    fecha: "07-04-2026",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Parámetros de disponibilidad inválidos.",
  );

  assertStatus(response.status, 400);
});

test("hcm endpoints completos: aprobación de horas extras usa defaults", () => {
  const parsed = hcmHoraExtraAprobarBodySchema.safeParse({});

  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  assert.equal(parsed.data.aprobar, true);
});

test("hcm endpoints completos: contrato estable de error para contabilización fallida", async () => {
  const parsed = hcmContabilizarPreAsientosSchema.safeParse({
    preAsientoIds: [],
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const validationResponse = zodFirstErrorEnvelope(
    parsed.error,
    "Datos de contabilización inválidos.",
  );

  assertStatus(validationResponse.status, 400);

  const conflict = jsonError(
    409,
    "HCM_PRE_ASIENTO_POSTING_FAILED",
    "No se pudo contabilizar ningún pre-asiento.",
    {
      preAsientoIds: ["pre-1", "pre-2"],
    },
  );

  assertStatus(conflict.status, 409);

  const payload = await conflict.json();

  assertErrorEnvelopeShape(payload);
  assertFieldError(payload, "preAsientoIds");
  assert.equal(payload.code, "HCM_PRE_ASIENTO_POSTING_FAILED");
});
