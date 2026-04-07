/**
 * Tests de regresión — Flujo Asesor: Cliente y ciclo de vida del pedido
 *
 * Escenario: VN-014229 · Mundialito Alcaldía de Pereira (El Olímpico) 2026
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  canTransitionOrderStatus,
  getAllowedNextOrderStatuses,
  calculateOrderPaymentPercent,
  requiresApprovalBeforeProgramming,
  isOrderStatus,
} from "@/src/utils/order-workflow";

import { isClientEligibleForQuotation } from "@/src/utils/business-rule-guards";
import { formatOrderStatusReason } from "@/src/utils/order-status-reason";

test("asesor workflow — cliente ALCALDIA DE PEREIRA activo es elegible para cotización", () => {
  const client = { id: "client-alcaldia-pereira-001", isActive: true };
  assert.equal(isClientEligibleForQuotation(client), true);
});

test("asesor workflow — cliente inactivo no es elegible", () => {
  const client = { id: "client-club-acuarium-002", isActive: false };
  assert.equal(isClientEligibleForQuotation(client), false);
});

test("asesor workflow — cliente null no es elegible", () => {
  assert.equal(isClientEligibleForQuotation(null), false);
});

test("asesor workflow — cliente con isActive null no es elegible", () => {
  const client = { id: "client-sin-estado", isActive: null };
  assert.equal(isClientEligibleForQuotation(client), false);
});

test("asesor workflow — anticipo de $8.500.000 sobre pedido de $16.150.000 supera el 50%", () => {
  const percent = calculateOrderPaymentPercent({
    total: "16000000",
    shippingFee: "150000",
    paidTotal: "8500000",
  });

  assert.ok(percent > 50, `Porcentaje esperado >50%, obtenido: ${percent.toFixed(2)}%`);
});

test("asesor workflow — anticipo del 50% exacto no requiere aprobación previa", () => {
  assert.equal(requiresApprovalBeforeProgramming(50), false);
});

test("asesor workflow — anticipo de $7.000.000 requiere aprobación contable", () => {
  const percent = calculateOrderPaymentPercent({
    total: "16000000",
    shippingFee: "150000",
    paidTotal: "7000000",
  });

  assert.ok(percent < 50, `Porcentaje esperado <50%, obtenido: ${percent.toFixed(2)}%`);
  assert.equal(requiresApprovalBeforeProgramming(percent), true);
});

test("asesor workflow — pedido sin anticipo siempre requiere aprobación contable", () => {
  const percent = calculateOrderPaymentPercent({
    total: "16000000",
    shippingFee: "150000",
    paidTotal: "0",
  });

  assert.equal(percent, 0);
  assert.equal(requiresApprovalBeforeProgramming(0), true);
});

test("asesor workflow — anticipo 52,63% no requiere aprobación", () => {
  const percent = calculateOrderPaymentPercent({
    total: "16000000",
    shippingFee: "150000",
    paidTotal: "8500000",
  });

  assert.equal(requiresApprovalBeforeProgramming(percent), false);
});

test("asesor workflow — PENDIENTE es estado válido del pedido", () => {
  assert.equal(isOrderStatus("PENDIENTE"), true);
});

test("asesor workflow — BORRADOR no es estado válido", () => {
  assert.equal(isOrderStatus("BORRADOR"), false);
});

test("asesor workflow — PENDIENTE puede pasar a APROBACION o PENDIENTE_CONTABILIDAD", () => {
  const allowed = getAllowedNextOrderStatuses("PENDIENTE");

  assert.ok(allowed.includes("APROBACION"), "Debe incluir APROBACION");
  assert.ok(
    allowed.includes("PENDIENTE_CONTABILIDAD"),
    "Debe incluir PENDIENTE_CONTABILIDAD",
  );
});

test("asesor workflow — APROBADO_CONTABILIDAD puede pasar a PROGRAMACION", () => {
  assert.equal(canTransitionOrderStatus("APROBADO_CONTABILIDAD", "PROGRAMACION"), true);
});

test("asesor workflow — APROBACION puede pasar a PROGRAMACION", () => {
  assert.equal(canTransitionOrderStatus("APROBACION", "PROGRAMACION"), true);
});

test("asesor workflow — PROGRAMACION puede pasar a PRODUCCION", () => {
  assert.equal(canTransitionOrderStatus("PROGRAMACION", "PRODUCCION"), true);
});

test("asesor workflow — PRODUCCION puede pasar a FINALIZADO", () => {
  assert.equal(canTransitionOrderStatus("PRODUCCION", "FINALIZADO"), true);
});

test("asesor workflow — FINALIZADO puede pasar a ENTREGADO", () => {
  assert.equal(canTransitionOrderStatus("FINALIZADO", "ENTREGADO"), true);
});

test("asesor workflow — ENTREGADO es estado final", () => {
  const allowed = getAllowedNextOrderStatuses("ENTREGADO");
  assert.equal(allowed.length, 0);
});

test("asesor workflow — no se puede saltar de PENDIENTE a PRODUCCION", () => {
  assert.equal(canTransitionOrderStatus("PENDIENTE", "PRODUCCION"), false);
});

test("asesor workflow — no se puede saltar de PENDIENTE a FINALIZADO", () => {
  assert.equal(canTransitionOrderStatus("PENDIENTE", "FINALIZADO"), false);
});

test("asesor workflow — CANCELADO es estado final", () => {
  const allowed = getAllowedNextOrderStatuses("CANCELADO");
  assert.equal(allowed.length, 0);
});

test("asesor workflow — razón ACCOUNTING_APPROVED_ADVANCE muestra texto en español", () => {
  const label = formatOrderStatusReason("ACCOUNTING_APPROVED_ADVANCE", "es");
  assert.notEqual(label, "-");
  assert.notEqual(label, "");
});

test("asesor workflow — razón AUTO_SCHEDULE_AFTER_ACCOUNTING muestra texto en español", () => {
  const label = formatOrderStatusReason("AUTO_SCHEDULE_AFTER_ACCOUNTING", "es");
  assert.notEqual(label, "-");
});

test("asesor workflow — razón ADVISOR_REQUEST_SCHEDULING disponible para solicitudes manuales", () => {
  const label = formatOrderStatusReason("ADVISOR_REQUEST_SCHEDULING", "es");
  assert.notEqual(label, "-");
});

test("asesor workflow — code vacío retorna guión", () => {
  const label = formatOrderStatusReason(null, "es");
  assert.equal(label, "-");
});

test("asesor workflow — misma transición de estado se considera válida", () => {
  assert.equal(canTransitionOrderStatus("PROGRAMACION", "PROGRAMACION"), true);
});

test("asesor workflow — estado origen inválido no permite transición", () => {
  assert.equal(canTransitionOrderStatus("BORRADOR", "PROGRAMACION"), false);
});

test("asesor workflow — pedido sin base de cálculo retorna 0%", () => {
  const percent = calculateOrderPaymentPercent({
    total: "0",
    shippingFee: "0",
    paidTotal: "5000000",
  });

  assert.equal(percent, 0);
});