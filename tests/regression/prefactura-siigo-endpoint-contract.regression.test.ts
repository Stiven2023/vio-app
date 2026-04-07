import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import {
  normalizeProtectedRouteError,
  prefacturaIdRequiredError,
  prefacturaNotFoundError,
  prefacturaReasonRequiredError,
  siigoAlreadySentError,
  siigoDryRunError,
  siigoInvoiceIdRequiredError,
  siigoMissingClientIdentificationError,
  siigoMissingConfigurationError,
  siigoNotApplicableError,
  siigoResetNotAllowedError,
  siigoUpstreamError,
} from "@/src/utils/prefactura-siigo-contract";

test("prefactura siigo contrato: normaliza 401 y 403 protegidos", async () => {
  const unauthorized = normalizeProtectedRouteError(
    new Response("Unauthorized", { status: 401 }),
  );
  const forbidden = normalizeProtectedRouteError(
    new Response("Forbidden", { status: 403 }),
    "Solo contabilidad puede operar SIIGO.",
  );

  assert.equal(unauthorized?.status, 401);
  assert.equal(forbidden?.status, 403);

  const unauthorizedPayload = await unauthorized?.json();
  const forbiddenPayload = await forbidden?.json();

  assertErrorEnvelopeShape(unauthorizedPayload);
  assertErrorEnvelopeShape(forbiddenPayload);
  assert.equal(unauthorizedPayload.code, "UNAUTHORIZED");
  assert.equal(forbiddenPayload.code, "FORBIDDEN");
});

test("prefactura siigo contrato: valida id y motivo requeridos", async () => {
  const idResponse = prefacturaIdRequiredError();
  const reasonResponse = prefacturaReasonRequiredError();

  assertStatus(idResponse.status, 400);
  assertStatus(reasonResponse.status, 400);

  const idPayload = await idResponse.json();
  const reasonPayload = await reasonResponse.json();

  assertErrorEnvelopeShape(idPayload);
  assertErrorEnvelopeShape(reasonPayload);
  assertFieldError(idPayload, "id", "prefactura");
  assertFieldError(reasonPayload, "reason", "motivo");
});

test("prefactura siigo contrato: not found mantiene envelope estable", async () => {
  const response = prefacturaNotFoundError();
  const payload = await response.json();

  assertStatus(response.status, 404);
  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "NOT_FOUND");
});

test("prefactura siigo contrato: documento tipo R responde no aplicable", async () => {
  const response = siigoNotApplicableError();
  const payload = await response.json();

  assertStatus(response.status, 422);
  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "SIIGO_NOT_APPLICABLE");
});

test("prefactura siigo contrato: reenvio bloqueado reporta estado siigo actual", async () => {
  const response = siigoAlreadySentError("SENT");
  const payload = await response.json();

  assertStatus(response.status, 409);
  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "SIIGO_ALREADY_SENT");
  assertFieldError(payload, "siigoStatus", "SENT");
});

test("prefactura siigo contrato: cliente sin identificacion apunta al campo correcto", async () => {
  const response = siigoMissingClientIdentificationError();
  const payload = await response.json();

  assertStatus(response.status, 422);
  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "MISSING_CLIENT_IDENTIFICATION");
  assertFieldError(payload, "clientIdentification", "identificacion");
});

test("prefactura siigo contrato: configuracion faltante o invalida conserva fieldErrors", async () => {
  const response = siigoMissingConfigurationError({
    missingConfig: ["SIIGO_SELLER_ID"],
    invalidConfig: ["SIIGO_IVA_TAX_ID"],
  });
  const payload = await response.json();

  assertStatus(response.status, 422);
  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "SIIGO_CONFIGURATION_INVALID");
  assertFieldError(payload, "SIIGO_SELLER_ID", "faltante");
  assertFieldError(payload, "SIIGO_IVA_TAX_ID", "invalida");
  const enrichedPayload = payload as {
    missingConfig?: string[];
    invalidConfig?: string[];
  };
  assert.deepEqual(enrichedPayload.missingConfig, ["SIIGO_SELLER_ID"]);
  assert.deepEqual(enrichedPayload.invalidConfig, ["SIIGO_IVA_TAX_ID"]);
});

test("prefactura siigo contrato: dry run expone preview y envelope estable", async () => {
  const response = siigoDryRunError({
    liveSubmissionEnabled: false,
    productionEnvironment: false,
    preview: {
      prefacturaId: "pf-1",
      prefacturaCode: "PF-001",
      documentType: "F",
      items: 3,
      total: 150000,
      currency: "COP",
    },
  });
  const payload = await response.json();

  assertStatus(response.status, 409);
  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "SIIGO_DRY_RUN");
  assertFieldError(payload, "siigo", "SIIGO_ALLOW_LIVE_SUBMISSION");
  const enrichedPayload = payload as {
    preview?: { prefacturaCode?: string };
  };
  assert.equal(enrichedPayload.preview?.prefacturaCode, "PF-001");
});

test("prefactura siigo contrato: poll sin invoice id responde 422 con campo estable", async () => {
  const response = siigoInvoiceIdRequiredError("READY");
  const payload = await response.json();

  assertStatus(response.status, 422);
  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "SIIGO_INVOICE_ID_REQUIRED");
  assertFieldError(payload, "siigoInvoiceId", "Envia la prefactura");
  const enrichedPayload = payload as {
    siigoStatus?: string | null;
  };
  assert.equal(enrichedPayload.siigoStatus, "READY");
});

test("prefactura siigo contrato: reset no permitido y error upstream usan codigos estables", async () => {
  const resetResponse = siigoResetNotAllowedError();
  const upstreamResponse = siigoUpstreamError(
    "No fue posible consultar el estado en SIIGO.",
  );

  const resetPayload = await resetResponse.json();
  const upstreamPayload = await upstreamResponse.json();

  assertStatus(resetResponse.status, 409);
  assertStatus(upstreamResponse.status, 502);
  assertErrorEnvelopeShape(resetPayload);
  assertErrorEnvelopeShape(upstreamPayload);
  assert.equal(resetPayload.code, "SIIGO_RESET_NOT_ALLOWED");
  assert.equal(upstreamPayload.code, "SIIGO_ERROR");
});
