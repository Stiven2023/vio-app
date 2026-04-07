import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { zodFirstErrorEnvelope, jsonError } from "@/src/utils/api-error";
import {
  createMessengerSchema,
  deleteMessengerSchema,
  updateMessengerSchema,
} from "@/src/utils/messengers-contract";

test("messengers contrato: acepta payload minimo de creacion", () => {
  const parsed = createMessengerSchema.safeParse({
    name: "Mensajero Uno",
    identificationType: "CC",
    identification: "123456789",
    address: "Calle 10 # 20-30",
    messengerType: "MENSAJERO",
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  assert.equal(parsed.data.isActive, true);
});

test("messengers contrato: rechaza creacion sin nombre", () => {
  const parsed = createMessengerSchema.safeParse({
    name: "",
    identificationType: "CC",
    identification: "123456789",
    address: "Calle 10 # 20-30",
    messengerType: "MENSAJERO",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Los datos de mensajero/conductor son inválidos.",
  );

  assertStatus(response.status, 400);
});

test("messengers contrato: valida id obligatorio en update/delete", () => {
  const invalidUpdate = updateMessengerSchema.safeParse({ id: "" });
  const invalidDelete = deleteMessengerSchema.safeParse({ id: "" });

  assert.equal(invalidUpdate.success, false);
  assert.equal(invalidDelete.success, false);
});

test("messengers contrato: error envelope estable con fieldErrors", async () => {
  const response = jsonError(
    409,
    "MESSENGER_IN_USE",
    "No se puede eliminar el mensajero/conductor.",
    {
      id: ["El mensajero/conductor tiene envíos asociados."],
    },
  );

  assertStatus(response.status, 409);

  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assertFieldError(payload, "id", "envíos asociados");
  assert.equal(payload.code, "MESSENGER_IN_USE");
});
