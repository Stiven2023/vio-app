/**
 * Tests de regresión — Flujo Asesor: estados y etiquetas de pago
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  isConfirmedPaymentStatus,
  canSetPaymentStatusOnApproval,
  normalizePaymentStatusLabel,
} from "@/src/utils/payment-status";

test("asesor payment — PAGADO es confirmado", () => {
  assert.equal(isConfirmedPaymentStatus("PAGADO"), true);
});

test("asesor payment — CONFIRMADO_CAJA también es confirmado", () => {
  assert.equal(isConfirmedPaymentStatus("CONFIRMADO_CAJA"), true);
});

test("asesor payment — PARCIAL no está confirmado", () => {
  assert.equal(isConfirmedPaymentStatus("PARCIAL"), false);
});

test("asesor payment — PENDIENTE no está confirmado", () => {
  assert.equal(isConfirmedPaymentStatus("PENDIENTE"), false);
});

test("asesor payment — en aprobación solo se puede marcar PAGADO o ANULADO", () => {
  assert.equal(canSetPaymentStatusOnApproval("PAGADO"), true);
  assert.equal(canSetPaymentStatusOnApproval("ANULADO"), true);
  assert.equal(canSetPaymentStatusOnApproval("PARCIAL"), false);
});

test("asesor payment — PENDIENTE muestra NO CONSIGNADO", () => {
  assert.equal(normalizePaymentStatusLabel("PENDIENTE"), "NO CONSIGNADO");
});

test("asesor payment — PARCIAL muestra CONSIGNADO", () => {
  assert.equal(normalizePaymentStatusLabel("PARCIAL"), "CONSIGNADO");
});

test("asesor payment — PAGADO muestra APROBADO", () => {
  assert.equal(normalizePaymentStatusLabel("PAGADO"), "APROBADO");
});

test("asesor payment — CONFIRMADO_CAJA muestra RECIBIDO EN CAJA", () => {
  assert.equal(normalizePaymentStatusLabel("CONFIRMADO_CAJA"), "RECIBIDO EN CAJA");
});

test("asesor payment — estado en minúscula se normaliza correctamente", () => {
  assert.equal(normalizePaymentStatusLabel("pagado"), "APROBADO");
});