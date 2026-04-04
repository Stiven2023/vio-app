import assert from "node:assert/strict";
import test from "node:test";

import { CRM_PREVIEW_ROWS } from "@/app/crm/_components/crm-mock-data";
import { ACCOUNTING_PREVIEW_ROWS } from "@/app/erp/contabilidad-modulo/_components/accounting-mock-data";

test("crm preview data: expone 5 oportunidades demo", () => {
  assert.equal(CRM_PREVIEW_ROWS.length, 5);
});

test("crm preview data: cubre etapas comerciales del pipeline", () => {
  const stages = new Set(CRM_PREVIEW_ROWS.map((row) => row.stage));

  assert.equal(stages.has("LEAD"), true);
  assert.equal(stages.has("CONTACTADO"), true);
  assert.equal(stages.has("PROPUESTA"), true);
  assert.equal(stages.has("NEGOCIACION"), true);
  assert.equal(stages.has("CIERRE"), true);
});

test("accounting preview data: expone 5 casos demo", () => {
  assert.equal(ACCOUNTING_PREVIEW_ROWS.length, 5);
});

test("accounting preview data: cubre estados contables visuales", () => {
  const statuses = new Set(ACCOUNTING_PREVIEW_ROWS.map((row) => row.status));

  assert.equal(statuses.has("BORRADOR"), true);
  assert.equal(statuses.has("PENDIENTE"), true);
  assert.equal(statuses.has("EN_REVISION"), true);
  assert.equal(statuses.has("CONCILIANDO"), true);
  assert.equal(statuses.has("LISTO"), true);
});