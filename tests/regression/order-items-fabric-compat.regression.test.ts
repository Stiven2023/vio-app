import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { jsonError } from "@/src/utils/api-error";
import { splitLegacyCompatibleFabrics } from "@/src/utils/molding-fabric-compat";

test("splitLegacyCompatibleFabrics separa por coma, punto y coma y salto de línea", () => {
  const result = splitLegacyCompatibleFabrics(
    "Lycra; Poliéster, Malla\nAlgodón",
  );

  assert.deepEqual(result, ["Lycra", "Poliéster", "Malla", "Algodón"]);
});

test("splitLegacyCompatibleFabrics ignora vacíos y espacios", () => {
  const result = splitLegacyCompatibleFabrics("  , ,  Lycra  ;   ; ");

  assert.deepEqual(result, ["Lycra"]);
});

test("order item compat: error contract para tela incompatible", async () => {
  const response = jsonError(
    422,
    "MOLDING_FABRIC_NOT_COMPATIBLE",
    "La tela del diseño no es compatible con la moldería seleccionada.",
    {
      fabric: ["La tela no es compatible con la moldería seleccionada."],
    },
  );

  assertStatus(response.status, 422);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assertFieldError(payload, "fabric");
  assert.equal(payload.code, "MOLDING_FABRIC_NOT_COMPATIBLE");
});
