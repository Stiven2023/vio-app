import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveAccountingSourceModule,
  resolveVoucherType,
} from "@/src/accounting/journal-engine.helpers";
import { formatAccountingPeriodFromDate } from "@/src/accounting/accounting-period.helpers";

test("accounting engine helpers: resuelven módulo contable por sourceType", () => {
  assert.equal(resolveAccountingSourceModule("PREFACTURA"), "SALES");
  assert.equal(resolveAccountingSourceModule("SUPPLIER_INVOICE"), "PURCHASING");
  assert.equal(resolveAccountingSourceModule("STOCK_MOVEMENT"), "INVENTORY");
  assert.equal(resolveAccountingSourceModule("MANUAL"), "GENERAL");
});

test("accounting engine helpers: resuelven tipo de comprobante", () => {
  assert.equal(resolveVoucherType("PREFACTURA"), "IN");
  assert.equal(resolveVoucherType("SUPPLIER_PAYMENT"), "EG");
  assert.equal(resolveVoucherType("FACTORING"), "CD");
  assert.equal(resolveVoucherType("CLOSURE"), "CL");
});

test("accounting engine helpers: derivan período contable desde fecha ISO", () => {
  assert.equal(formatAccountingPeriodFromDate("2026-04-04"), "2026-04");
  assert.throws(
    () => formatAccountingPeriodFromDate("2026/04/04"),
    /YYYY-MM-DD/,
  );
});