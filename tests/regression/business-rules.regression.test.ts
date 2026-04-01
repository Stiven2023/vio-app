import assert from "node:assert/strict";
import test from "node:test";

import {
  hasDateRangeOverlap,
  hasDuplicateOrderAllocations,
  isClientEligibleForQuotation,
  isPermissionHoursValid,
  normalizePermissionHours,
  parseRatePercentage,
} from "@/src/utils/business-rule-guards";

test("vacaciones: detecta solapamiento de rangos", () => {
  assert.equal(
    hasDateRangeOverlap("2026-04-10", "2026-04-15", "2026-04-14", "2026-04-20"),
    true,
  );
  assert.equal(
    hasDateRangeOverlap("2026-04-10", "2026-04-15", "2026-04-16", "2026-04-20"),
    false,
  );
});

test("permisos: horas deben estar entre 0.5 y 24", () => {
  assert.equal(isPermissionHoursValid(0.49), false);
  assert.equal(isPermissionHoursValid(0.5), true);
  assert.equal(isPermissionHoursValid(24), true);
  assert.equal(isPermissionHoursValid(24.1), false);
});

test("permisos: normaliza horas solo para tipo PERMISO", () => {
  assert.equal(normalizePermissionHours("PERMISO", "2"), "2.00");
  assert.equal(normalizePermissionHours("PERMISO", "0.1"), null);
  assert.equal(normalizePermissionHours("RECLAMO", "2"), null);
});

test("pagos distribuidos: bloquea orderId duplicado", () => {
  assert.equal(
    hasDuplicateOrderAllocations([
      { orderId: "o-1" },
      { orderId: "o-2" },
      { orderId: "o-1" },
    ]),
    true,
  );
  assert.equal(
    hasDuplicateOrderAllocations([{ orderId: "o-1" }, { orderId: "o-2" }]),
    false,
  );
});

test("cotizaciones: cliente debe existir y estar activo", () => {
  assert.equal(isClientEligibleForQuotation(null), false);
  assert.equal(
    isClientEligibleForQuotation({ id: "c-1", isActive: false }),
    false,
  );
  assert.equal(
    isClientEligibleForQuotation({ id: "c-1", isActive: true }),
    true,
  );
});

test("retenciones: tasa en rango [0,100]", () => {
  assert.equal(parseRatePercentage(-1), null);
  assert.equal(parseRatePercentage(0), "0.0000");
  assert.equal(parseRatePercentage(100), "100.0000");
  assert.equal(parseRatePercentage(101), null);
});
