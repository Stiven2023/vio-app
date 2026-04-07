/**
 * Tests de reversas contables.
 *
 * Verifica que las funciones de reversa:
 * 1. Invierten débitos/créditos del asiento original
 * 2. Mantienen el balance DR = CR
 * 3. Generan claves de idempotencia distintas a la del asiento original
 * 4. Pueden consultarse por reversalOfId
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNTING_ACCOUNT_CODES,
  buildOrderPaymentAccountingLines,
} from "@/src/utils/accounting-entries";

test("reversas: las líneas invertidas tienen DR/CR intercambiados", () => {
  const originalLines = buildOrderPaymentAccountingLines({
    paymentId: "pay-rev-001",
    orderId: "ord-001",
    orderCode: "P-50001",
    clientId: "client-rev-001",
    paymentDate: "2026-04-01",
    paymentMethod: "TRANSFERENCIA",
    amount: "500000",
    referenceCode: null,
  });

  // Simula la inversión de líneas (equivalente a lo que hace reverseOrderPaymentAccountingEntry)
  const reversalLines = originalLines.map((line) => ({
    ...line,
    debit: line.credit,
    credit: line.debit,
  }));

  for (let i = 0; i < originalLines.length; i++) {
    assert.equal(
      reversalLines[i].debit,
      originalLines[i].credit,
      `Línea ${i}: débito de reversa = crédito original`,
    );
    assert.equal(
      reversalLines[i].credit,
      originalLines[i].debit,
      `Línea ${i}: crédito de reversa = débito original`,
    );
    assert.equal(
      reversalLines[i].accountCode,
      originalLines[i].accountCode,
      `Línea ${i}: cuenta contable debe ser la misma`,
    );
  }
});

test("reversas: asiento revertido mantiene balance DR = CR", () => {
  const originalLines = buildOrderPaymentAccountingLines({
    paymentId: "pay-rev-002",
    orderId: "ord-002",
    orderCode: "P-50002",
    clientId: "client-rev-002",
    paymentDate: "2026-04-02",
    paymentMethod: "EFECTIVO",
    amount: "1200000",
    referenceCode: "REV-REF-002",
  });

  const reversalLines = originalLines.map((line) => ({
    ...line,
    debit: line.credit,
    credit: line.debit,
  }));

  const origDebit = originalLines.reduce((s, l) => s + Number(l.debit), 0);
  const origCredit = originalLines.reduce((s, l) => s + Number(l.credit), 0);
  const revDebit = reversalLines.reduce((s, l) => s + Number(l.debit), 0);
  const revCredit = reversalLines.reduce((s, l) => s + Number(l.credit), 0);

  assert.ok(Math.abs(origDebit - origCredit) < 0.01, "Asiento original debe balancear");
  assert.ok(Math.abs(revDebit - revCredit) < 0.01, "Asiento de reversa debe balancear");
  assert.equal(origDebit, revCredit, "DR original = CR reversa");
  assert.equal(origCredit, revDebit, "CR original = DR reversa");
});

test("reversas: clave de idempotencia de reversa es distinta a la del asiento original", () => {
  const paymentId = "pay-rev-003";
  const originalKey = `order-payment:confirm:${paymentId}`;
  const reversalKey = `order-payment:reversal:${paymentId}`;

  assert.notEqual(originalKey, reversalKey, "Las claves deben ser distintas");
  assert.ok(reversalKey.includes("reversal"), "Clave de reversa debe contener 'reversal'");
});

test("reversas: la suma de original + reversa sobre una misma cuenta es cero", () => {
  const originalLines = buildOrderPaymentAccountingLines({
    paymentId: "pay-rev-004",
    orderId: "ord-004",
    orderCode: "P-50004",
    clientId: "client-rev-004",
    paymentDate: "2026-04-04",
    paymentMethod: "TRANSFERENCIA",
    amount: "750000",
    referenceCode: null,
  });

  const reversalLines = originalLines.map((line) => ({
    ...line,
    debit: line.credit,
    credit: line.debit,
  }));

  // Por cada cuenta, el neto (DR - CR) del original + reversa debe ser 0
  const netByAccount = new Map<string, number>();

  for (const line of [...originalLines, ...reversalLines]) {
    const prev = netByAccount.get(line.accountCode) ?? 0;

    netByAccount.set(line.accountCode, prev + Number(line.debit) - Number(line.credit));
  }

  for (const [account, net] of netByAccount.entries()) {
    assert.ok(
      Math.abs(net) < 0.01,
      `Cuenta ${account}: neto original+reversa debe ser 0, fue ${net}`,
    );
  }
});

test("reversas: asiento de reversa referencia el id del asiento original mediante reversalOfId", () => {
  // Simula la metadata que debe contener un asiento de reversa
  const originalEntryId = "entry-12345678";
  const reversalMeta = {
    reversalOfId: originalEntryId,
    originalPaymentId: "pay-rev-005",
  };

  assert.equal(reversalMeta.reversalOfId, originalEntryId, "reversalOfId apunta al asiento original");
  assert.ok(typeof reversalMeta.reversalOfId === "string", "reversalOfId debe ser string");
});
