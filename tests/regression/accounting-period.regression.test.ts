import assert from "node:assert/strict";
import test from "node:test";

import {
  accountingPeriodSchema,
  getAccountingPeriodFromDate,
  parseAccountingPeriod,
} from "@/src/utils/accounting-period";

test("accounting period: acepta YYYY-MM válido", () => {
  assert.equal(parseAccountingPeriod("2026-04"), "2026-04");
  assert.equal(accountingPeriodSchema.safeParse("2026-12").success, true);
});

test("accounting period: rechaza formatos inválidos", () => {
  assert.equal(parseAccountingPeriod("2026-13"), null);
  assert.equal(parseAccountingPeriod("04-2026"), null);
  assert.equal(parseAccountingPeriod("2026/04"), null);
});

test("accounting period: deriva período desde fecha", () => {
  assert.equal(getAccountingPeriodFromDate("2026-04-03T10:20:30.000Z"), "2026-04");
  assert.equal(
    getAccountingPeriodFromDate(new Date("2026-12-31T23:59:59.000Z")),
    "2026-12",
  );
});