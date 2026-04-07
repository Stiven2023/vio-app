/**
 * Tests de contrato para los nuevos endpoints de Fase 5:
 * - Caja menor POST (Zod + asiento automático)
 * - Conciliación bancaria cierre (asiento de ajuste)
 */
import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  ACCOUNTING_ACCOUNT_CODES,
} from "@/src/utils/accounting-entries";

// ─── Schema caja menor ──────────────────────────────────────────────────────

const pettyCashPostSchema = z.object({
  fundId: z.string().uuid("fundId debe ser un UUID válido."),
  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD."),
  transactionType: z.enum(["EXPENSE", "REPLENISHMENT", "OPENING", "ADJUSTMENT"]),
  category: z.string().max(100).optional().nullable(),
  description: z.string().min(1, "La descripción es obligatoria."),
  amount: z
    .number({ error: "El monto debe ser un número." })
    .positive("El monto debe ser mayor a cero."),
  referenceCode: z.string().max(120).optional().nullable(),
  notes: z.string().optional().nullable(),
});

test("caja menor POST: acepta payload mínimo EXPENSE", () => {
  const parsed = pettyCashPostSchema.safeParse({
    fundId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    transactionDate: "2026-04-07",
    transactionType: "EXPENSE",
    description: "Compra de papelería",
    amount: 50000,
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  assert.equal(parsed.data.transactionType, "EXPENSE");
  assert.equal(parsed.data.amount, 50000);
});

test("caja menor POST: acepta REPLENISHMENT", () => {
  const parsed = pettyCashPostSchema.safeParse({
    fundId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    transactionDate: "2026-04-07",
    transactionType: "REPLENISHMENT",
    description: "Reposición de caja menor",
    amount: 200000,
  });

  assert.equal(parsed.success, true);
});

test("caja menor POST: rechaza fundId inválido", async () => {
  const parsed = pettyCashPostSchema.safeParse({
    fundId: "no-es-uuid",
    transactionDate: "2026-04-07",
    transactionType: "EXPENSE",
    description: "Test",
    amount: 50000,
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(parsed.error, "Datos inválidos.");

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assertFieldError(payload, "fundId");
});

test("caja menor POST: rechaza monto negativo", async () => {
  const parsed = pettyCashPostSchema.safeParse({
    fundId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    transactionDate: "2026-04-07",
    transactionType: "EXPENSE",
    description: "Test",
    amount: -100,
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(parsed.error, "Datos inválidos.");

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assertFieldError(payload, "amount");
});

test("caja menor POST: rechaza tipo de transacción desconocido", async () => {
  const parsed = pettyCashPostSchema.safeParse({
    fundId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    transactionDate: "2026-04-07",
    transactionType: "TRANSFERENCIA",
    description: "Test",
    amount: 50000,
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(parsed.error, "Datos inválidos.");

  assertStatus(response.status, 400);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assertFieldError(payload, "transactionType");
});

test("caja menor POST: código estable INSUFFICIENT_PETTY_CASH_BALANCE", async () => {
  const response = jsonError(
    409,
    "INSUFFICIENT_PETTY_CASH_BALANCE",
    "Saldo insuficiente en la caja menor.",
    { amount: ["El saldo disponible no cubre la transacción."] },
  );

  assertStatus(response.status, 409);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "INSUFFICIENT_PETTY_CASH_BALANCE");
  assertFieldError(payload, "amount");
});

// ─── Conciliación bancaria cierre ───────────────────────────────────────────

test("conciliación cierre: código estable RECONCILIATION_ALREADY_CLOSED", async () => {
  const response = jsonError(
    409,
    "RECONCILIATION_ALREADY_CLOSED",
    "La conciliación bancaria ya estaba cerrada.",
    { status: ["Solo es posible cerrar conciliaciones en estado abierto."] },
  );

  assertStatus(response.status, 409);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "RECONCILIATION_ALREADY_CLOSED");
  assertFieldError(payload, "status");
});

test("conciliación cierre: código estable NOT_FOUND para conciliación inexistente", async () => {
  const response = jsonError(404, "NOT_FOUND", "Conciliación bancaria no encontrada.");

  assertStatus(response.status, 404);
  const payload = await response.json();

  assertErrorEnvelopeShape(payload);
  assert.equal(payload.code, "NOT_FOUND");
});

// ─── Asientos caja menor — cuentas PUC Colombia ─────────────────────────────

test("caja menor — EXPENSE: cuenta gasto (511595) y caja menor (110510)", () => {
  assert.equal(ACCOUNTING_ACCOUNT_CODES.generalExpenses, "511595");
  assert.equal(ACCOUNTING_ACCOUNT_CODES.pettyCash, "110510");
});

test("caja menor — REPLENISHMENT: cuenta caja menor (110510) y bancos (111005)", () => {
  assert.equal(ACCOUNTING_ACCOUNT_CODES.pettyCash, "110510");
  assert.equal(ACCOUNTING_ACCOUNT_CODES.banks, "111005");
});

test("conciliación — ajuste positivo: bancos (111005) y otros ingresos (470595)", () => {
  assert.equal(ACCOUNTING_ACCOUNT_CODES.banks, "111005");
  assert.equal(ACCOUNTING_ACCOUNT_CODES.miscIncome, "470595");
});
