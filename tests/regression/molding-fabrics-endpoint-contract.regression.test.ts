import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  fabricsQuerySchema,
  moldingTemplateFabricUpsertSchema,
  moldingTemplateFabricParamsSchema,
} from "@/src/utils/molding-fabrics-contract";

test("fabrics contract: query válida con filtros", () => {
  const parsed = fabricsQuerySchema.safeParse({
    search: "lycra",
    category: "LICRA",
    activeOnly: "true",
  });

  assert.equal(parsed.success, true);
});

test("fabrics contract: category inválida devuelve envelope 400", async () => {
  const parsed = fabricsQuerySchema.safeParse({
    category: "INVALIDA",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(parsed.error, "Parámetros de telas inválidos.");

  assertStatus(response.status, 400);

  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
});

test("molding template fabrics contract: requiere id uuid", async () => {
  const parsed = moldingTemplateFabricParamsSchema.safeParse({ id: "abc" });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(parsed.error, "Parámetros de moldería inválidos.");

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assertFieldError(payload, "id");
});

test("molding-template fabrics business error usa código estable", async () => {
  const response = jsonError(
    422,
    "MOLDING_FABRIC_NOT_COMPATIBLE",
    "La tela del diseño no es compatible con la moldería seleccionada.",
    {
      fabric: ["Tela no compatible"],
    },
  );

  assertStatus(response.status, 422);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "MOLDING_FABRIC_NOT_COMPATIBLE");
  assertFieldError(payload, "fabric");
});

test("molding-template fabrics upsert: acepta fabricIds validos", () => {
  const parsed = moldingTemplateFabricUpsertSchema.safeParse({
    fabricIds: ["2f1b8c38-4fd8-4d87-90d7-5d7bd95cb5df"],
  });

  assert.equal(parsed.success, true);
});

test("molding-template fabrics upsert: rechaza payload sin fabricIds ni fabricLinks", async () => {
  const parsed = moldingTemplateFabricUpsertSchema.safeParse({});

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Compatibilidades de telas invalidas.",
  );

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
});

test("molding template: código estable para conflicto de moldería", async () => {
  const response = jsonError(
    409,
    "MOLDING_TEMPLATE_CODE_CONFLICT",
    "La molderia 'MOL-0001' version 1 ya existe.",
    {
      moldingCode: ["El codigo de molderia ya existe para esa version."],
    },
  );

  assertStatus(response.status, 409);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "MOLDING_TEMPLATE_CODE_CONFLICT");
  assertFieldError(payload, "moldingCode");
});

test("molding template: código estable para fallo de actualización", async () => {
  const response = jsonError(
    500,
    "MOLDING_TEMPLATE_UPDATE_FAILED",
    "No se pudo actualizar la molderia.",
  );

  assertStatus(response.status, 500);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "MOLDING_TEMPLATE_UPDATE_FAILED");
});
