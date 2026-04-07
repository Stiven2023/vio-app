import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { zodFirstErrorEnvelope, jsonError } from "@/src/utils/api-error";
import { hcmLiquidarColillaSchema } from "@/src/utils/hcm-contract";

test("hcm colillas endpoint: valida body correcto", () => {
  const parsed = hcmLiquidarColillaSchema.safeParse({
    employeeId: "emp-1",
    period: "2026-04",
    salarioBase: 2500000,
    claseRiesgoARL: 2,
    generadoPor: "rh-1",
  });

  assert.equal(parsed.success, true);
});

test("hcm colillas endpoint: rechaza JSON de negocio invalido", async () => {
  const parsed = hcmLiquidarColillaSchema.safeParse({
    employeeId: "",
    period: "2026-13",
    salarioBase: -1,
    claseRiesgoARL: 2,
    generadoPor: "",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(parsed.error, "La solicitud de colilla es invalida.");
  const payload = await response.json();

  assertStatus(response.status, 400);
  assertErrorEnvelopeShape(payload);
  assertFieldError(payload, "employeeId");
});

test("hcm colillas endpoint: contrato estable de conflicto", async () => {
  const response = jsonError(409, "HCM_COLILLA_ALREADY_POSTED", "La colilla ya fue contabilizada.", {
    period: ["No se puede recalcular una colilla en estado CONTABILIZADA."],
  });

  const payload = await response.json();

  assertStatus(response.status, 409);
  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "HCM_COLILLA_ALREADY_POSTED");
  assertFieldError(payload, "period", "CONTABILIZADA");
});
