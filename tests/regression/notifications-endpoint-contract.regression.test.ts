import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  isUnreadOnly,
  notificationParamsSchema,
  notificationsBulkPatchSchema,
  notificationsQuerySchema,
} from "@/src/utils/notifications-contract";

test("notifications contrato: query valida acepta role y rango de fechas", () => {
  const result = notificationsQuerySchema.safeParse({
    page: "1",
    pageSize: "10",
    role: "RH",
    startDate: "2026-04-01",
    endDate: "2026-04-03",
    unreadOnly: "true",
  });

  assert.equal(result.success, true);
});

test("notifications contrato: query invalida cuando endDate < startDate", async () => {
  const parsed = notificationsQuerySchema.safeParse({
    startDate: "2026-04-10",
    endDate: "2026-04-01",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Parámetros de notificaciones inválidos.",
  );
  const payload = await response.json();

  assertStatus(response.status, 400);
  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assertFieldError(payload, "endDate", "fecha final");
});

test("notifications contrato: patch bulk rechaza ids no UUID", async () => {
  const parsed = notificationsBulkPatchSchema.safeParse({
    ids: ["abc"],
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Datos de notificaciones inválidos.",
  );
  const payload = await response.json();

  assertStatus(response.status, 400);
  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "VALIDATION_ERROR");
  assertFieldError(payload, "ids.0", "ID de notificación");
});

test("notifications contrato: params exige UUID en id", () => {
  const invalid = notificationParamsSchema.safeParse({ id: "123" });
  const valid = notificationParamsSchema.safeParse({
    id: "68e1fdf9-b705-4e17-8f89-18893017a5be",
  });

  assert.equal(invalid.success, false);
  assert.equal(valid.success, true);
});

test("notifications contrato: unreadOnly helper", () => {
  assert.equal(isUnreadOnly("1"), true);
  assert.equal(isUnreadOnly("true"), true);
  assert.equal(isUnreadOnly("0"), false);
  assert.equal(isUnreadOnly("false"), false);
  assert.equal(isUnreadOnly(undefined), false);
});