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

test("messengers contrato: exige vencimiento cuando se adjunta SOAT", () => {
  const parsed = createMessengerSchema.safeParse({
    name: "Mensajero Uno",
    identificationType: "CC",
    identification: "123456789",
    address: "Calle 10 # 20-30",
    messengerType: "CONDUCTOR",
    soatDocumentUrl: "https://files.example/soat.pdf",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Los datos de mensajero/conductor son inválidos.",
  );

  assertStatus(response.status, 400);
});

test("messengers contrato: acepta documentos con vencimientos en formato YYYY-MM-DD", () => {
  const parsed = createMessengerSchema.safeParse({
    name: "Conductor Dos",
    identificationType: "CC",
    identification: "987654321",
    address: "Carrera 25 # 44-10",
    messengerType: "CONDUCTOR",
    drivingLicenseUrl: "https://files.example/licencia-conduccion.pdf",
    drivingLicenseExpiresAt: "2027-04-15",
    vehicleLicenseDocumentUrl: "https://files.example/licencia-vehiculo.pdf",
    vehicleLicenseDocumentExpiresAt: "2027-05-01",
    soatDocumentUrl: "https://files.example/soat.pdf",
    soatDocumentExpiresAt: "2026-12-31",
    tecnomecanicaDocumentUrl: "https://files.example/tecnomecanica.pdf",
    tecnomecanicaDocumentExpiresAt: "2027-01-20",
  });

  assert.equal(parsed.success, true);
});

test("messengers contrato: valida formato de placa", () => {
  const parsed = createMessengerSchema.safeParse({
    name: "Conductor Tres",
    identificationType: "CC",
    identification: "999888777",
    address: "Calle 99 # 10-20",
    messengerType: "CONDUCTOR",
    vehicleType: "MOTO",
    vehiclePlate: "A12345",
  });

  assert.equal(parsed.success, false);
});

test("messengers contrato: exige tipo de vehículo cuando hay placa", () => {
  const parsed = createMessengerSchema.safeParse({
    name: "Conductor Cuatro",
    identificationType: "CC",
    identification: "111222333",
    address: "Carrera 1 # 2-3",
    messengerType: "CONDUCTOR",
    vehiclePlate: "ABC12D",
  });

  assert.equal(parsed.success, false);
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
