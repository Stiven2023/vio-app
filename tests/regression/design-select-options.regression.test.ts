import assert from "node:assert/strict";
import test from "node:test";

import {
  DISCIPLINE_OPTIONS,
  LOWER_GARMENT_OPTIONS,
} from "@/app/erp/orders/_lib/design-select-options";

test("design select options: disciplina incluye opciones clave sin duplicados", () => {
  const values = DISCIPLINE_OPTIONS.map((option) => option.value);

  assert.ok(values.includes("FUTBOL"));
  assert.ok(values.includes("CICLISMO"));
  assert.ok(values.includes("OTRO"));
  assert.equal(new Set(values).size, values.length);
});

test("design select options: parte inferior incluye opciones clave sin duplicados", () => {
  const values = LOWER_GARMENT_OPTIONS.map((option) => option.value);

  assert.ok(values.includes("PANTALONETA"));
  assert.ok(values.includes("LICRA_CORTA"));
  assert.ok(values.includes("PANTALON"));
  assert.ok(values.includes("OTRO"));
  assert.equal(new Set(values).size, values.length);
});