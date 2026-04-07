import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { zodFirstErrorEnvelope, jsonError } from "@/src/utils/api-error";
import {
  hcmLiquidarColillaSchema,
  hcmSolicitudHoraExtraSchema,
} from "@/src/utils/hcm-contract";

test("hcm contrato: valida payload minimo de liquidacion de colilla", () => {
  const parsed = hcmLiquidarColillaSchema.safeParse({
    employeeId: "emp-1",
    period: "2026-04",
    salarioBase: 2000000,
    claseRiesgoARL: 1,
    generadoPor: "emp-rh-1",
  });

  assert.equal(parsed.success, true);
});

test("hcm contrato: rechaza periodo invalido en liquidacion", () => {
  const parsed = hcmLiquidarColillaSchema.safeParse({
    employeeId: "emp-1",
    period: "2026/04",
    salarioBase: 2000000,
    claseRiesgoARL: 1,
    generadoPor: "emp-rh-1",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(parsed.error, "La solicitud de colilla es invalida.");
  assertStatus(response.status, 400);
});

test("hcm contrato: valida solicitud de horas extras", () => {
  const parsed = hcmSolicitudHoraExtraSchema.safeParse({
    employeeId: "emp-1",
    supervisorId: "sup-1",
    fecha: "2026-04-07",
    horaInicio: "18:00",
    horaFin: "20:30",
    tipo: "NOCTURNA_ORDINARIA",
    totalHoras: 2.5,
    actividad: "Ajuste final de pedido urgente",
    period: "2026-04",
  });

  assert.equal(parsed.success, true);
});

test("hcm contrato: rechaza hora fin menor o igual a hora inicio", () => {
  const parsed = hcmSolicitudHoraExtraSchema.safeParse({
    employeeId: "emp-1",
    supervisorId: "sup-1",
    fecha: "2026-04-07",
    horaInicio: "20:00",
    horaFin: "19:00",
    tipo: "NOCTURNA_ORDINARIA",
    totalHoras: 2.5,
    actividad: "Ajuste final de pedido urgente",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(parsed.error, "La solicitud de horas extras es invalida.");
  assertStatus(response.status, 400);
});

test("hcm contrato: error envelope estable para regla de negocio", async () => {
  const response = jsonError(
    409,
    "HCM_PRE_ASIENTO_ALREADY_POSTED",
    "El pre-asiento ya fue contabilizado.",
    {
      id: ["No se puede volver a contabilizar un pre-asiento en estado CONTABILIZADO."],
    },
  );

  assertStatus(response.status, 409);

  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assertFieldError(payload, "id", "pre-asiento");
  assert.equal(payload.code, "HCM_PRE_ASIENTO_ALREADY_POSTED");
});
