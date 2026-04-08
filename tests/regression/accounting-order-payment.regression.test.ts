import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNTING_ACCOUNT_CODES,
  buildOrderPaymentAccountingLines,
  computeOrderPaymentBreakdown,
} from "@/src/utils/accounting-entries";

test("order payment accounting: compone débito a tesorería y crédito a anticipos por compatibilidad", () => {
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

test("order payment accounting: separa abono a cartera y anticipo cuando es pago mixto", () => {
  const lines = buildOrderPaymentAccountingLines({
    paymentId: "pay-2",
    orderId: "ord-2",
    orderCode: "P-10002",
    clientId: "client-2",
    paymentDate: "2026-04-07",
    paymentMethod: "EFECTIVO",
    amount: "500000",
    appliedToReceivable: "300000",
    advanceAmount: "200000",
    paymentKind: "MIXTO",
  });

  assert.equal(lines.length, 3);
  assert.equal(lines[0]?.accountCode, ACCOUNTING_ACCOUNT_CODES.cashOnHand);
  assert.equal(lines[1]?.accountCode, ACCOUNTING_ACCOUNT_CODES.accountsReceivable);
  assert.equal(lines[1]?.credit, "300000.00");
  assert.equal(lines[2]?.accountCode, ACCOUNTING_ACCOUNT_CODES.customerAdvances);
  assert.equal(lines[2]?.credit, "200000.00");

  const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
  const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit), 0);

  assert.ok(Math.abs(totalDebit - totalCredit) < 0.01);
});

test("order payment breakdown: clasifica abono/anticipo según saldo pendiente", () => {
  const breakdown = computeOrderPaymentBreakdown({
    amount: "700000",
    orderTotal: "1000000",
    confirmedBeforePayment: "500000",
  });

  assert.equal(breakdown.appliedToReceivable, "500000.00");
  assert.equal(breakdown.advanceAmount, "200000.00");
  assert.equal(breakdown.paymentKind, "MIXTO");
});
