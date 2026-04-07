import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNTING_ACCOUNT_CODES,
  buildOrderPaymentAccountingLines,
} from "@/src/utils/accounting-entries";

test("order payment accounting: compone débito a tesorería y crédito a anticipos", () => {
  const lines = buildOrderPaymentAccountingLines({
    paymentId: "pay-1",
    orderId: "ord-1",
    orderCode: "P-10001",
    clientId: "client-1",
    paymentDate: "2026-04-07",
    paymentMethod: "TRANSFERENCIA",
    amount: "300000",
    referenceCode: "REF-123",
  });

  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.accountCode, ACCOUNTING_ACCOUNT_CODES.banks);
  assert.equal(lines[0]?.debit, "300000.00");
  assert.equal(lines[1]?.accountCode, ACCOUNTING_ACCOUNT_CODES.customerAdvances);
  assert.equal(lines[1]?.credit, "300000.00");

  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit), 0);

  assert.ok(Math.abs(totalDebit - totalCredit) < 0.01);
});
