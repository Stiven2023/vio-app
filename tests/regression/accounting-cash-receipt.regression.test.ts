import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNTING_ACCOUNT_CODES,
  buildCashReceiptAccountingLines,
} from "@/src/utils/accounting-entries";

test("cash receipt accounting: compone débito a caja y crédito a cartera", () => {
  const lines = buildCashReceiptAccountingLines({
    receiptId: "rc-1",
    receiptCode: "RC-000001",
    clientId: "client-1",
    receiptDate: "2026-04-03",
    paymentMethod: "EFECTIVO",
    amountReceived: "150000",
    creditBalance: "0",
    applications: [
      {
        prefacturaId: "pre-1",
        prefacturaCode: "PRE10001",
        appliedAmount: "150000",
      },
    ],
  });

  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.accountCode, ACCOUNTING_ACCOUNT_CODES.cashOnHand);
  assert.equal(lines[0]?.debit, "150000.00");
  assert.equal(lines[1]?.accountCode, ACCOUNTING_ACCOUNT_CODES.accountsReceivable);
  assert.equal(lines[1]?.credit, "150000.00");
});

test("cash receipt accounting: registra saldo a favor como anticipo", () => {
  const lines = buildCashReceiptAccountingLines({
    receiptId: "rc-2",
    receiptCode: "RC-000002",
    clientId: "client-1",
    receiptDate: "2026-04-03",
    paymentMethod: "TRANSFERENCIA",
    amountReceived: "200000",
    creditBalance: "50000",
    applications: [
      {
        prefacturaId: "pre-1",
        prefacturaCode: "PRE10001",
        appliedAmount: "150000",
      },
    ],
  });

  assert.equal(lines.length, 3);
  assert.equal(lines[0]?.accountCode, ACCOUNTING_ACCOUNT_CODES.banks);
  assert.equal(lines[2]?.accountCode, ACCOUNTING_ACCOUNT_CODES.customerAdvances);
  assert.equal(lines[2]?.credit, "50000.00");
});