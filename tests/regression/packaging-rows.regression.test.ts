import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePackagingRows,
  stripPackagingRowIds,
  toIndividualPackagingRows,
} from "@/app/erp/orders/_lib/packaging-rows";

test("packaging rows: asigna ids estables a filas individuales", () => {
  const rows = normalizePackagingRows([
    {
      mode: "INDIVIDUAL",
      size: "M",
      quantity: 1,
      personName: "Ana",
      personNumber: "10",
    },
    {
      mode: "AGRUPADO",
      size: "L",
      quantity: 2,
    },
  ]);

  assert.ok(rows[0].id);
  assert.equal(rows[1].id, undefined);
});

test("packaging rows: conserva ids existentes al expandir filas individuales", () => {
  const rows = toIndividualPackagingRows([
    {
      id: "stable-row",
      mode: "INDIVIDUAL",
      size: "M",
      quantity: 2,
      personName: "Ana",
      personNumber: "10",
    },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, "stable-row");
  assert.ok(rows[1].id);
  assert.notEqual(rows[1].id, "stable-row");
});

test("packaging rows: remueve ids auxiliares antes del payload", () => {
  const rows = stripPackagingRowIds([
    {
      id: "stable-row",
      mode: "INDIVIDUAL",
      size: "M",
      quantity: 1,
      personName: "Ana",
      personNumber: "10",
    },
  ]);

  assert.deepEqual(rows, [
    {
      mode: "INDIVIDUAL",
      size: "M",
      quantity: 1,
      personName: "Ana",
      personNumber: "10",
    },
  ]);
});