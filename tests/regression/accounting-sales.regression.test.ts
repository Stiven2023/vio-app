import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildSalesAccountingLines,
  ACCOUNTING_ACCOUNT_CODES,
} from "@/src/utils/accounting-entries";

describe("sales accounting", () => {
  it("genera débito a clientes y crédito a ventas + IVA para factura tipo F", () => {
    const lines = buildSalesAccountingLines({
      prefacturaId: "pf-001",
      prefacturaCode: "PF-2026-001",
      clientId: "cli-001",
      invoiceDate: "2026-04-01",
      subtotal: "840.34",
      ivaAmount: "159.66",
      total: "1000.00",
    });

    assert.equal(lines.length, 3);

    const debitLine = lines.find((l) => Number(l.debit) > 0);
    const salesLine = lines.find(
      (l) => l.accountCode === ACCOUNTING_ACCOUNT_CODES.salesRevenue,
    );
    const ivaLine = lines.find(
      (l) => l.accountCode === ACCOUNTING_ACCOUNT_CODES.ivaPayable,
    );

    assert.ok(debitLine, "debe existir línea de débito");
    assert.equal(debitLine.accountCode, ACCOUNTING_ACCOUNT_CODES.accountsReceivable);
    assert.equal(debitLine.debit, "1000.00");

    assert.ok(salesLine, "debe existir línea de ingresos");
    assert.equal(salesLine.credit, "840.34");

    assert.ok(ivaLine, "debe existir línea de IVA");
    assert.equal(ivaLine.credit, "159.66");

    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);

    assert.ok(
      Math.abs(totalDebit - totalCredit) < 0.01,
      `asiento debe balancear: ${totalDebit} vs ${totalCredit}`,
    );
  });

  it("genera débito a clientes y crédito a ventas no gravadas para remisión tipo R", () => {
    const lines = buildSalesAccountingLines({
      prefacturaId: "pf-002",
      prefacturaCode: "PF-2026-002",
      clientId: "cli-001",
      invoiceDate: "2026-04-02",
      subtotal: "500.00",
      ivaAmount: "0",
      total: "500.00",
    });

    assert.equal(lines.length, 2, "sin IVA solo deben generarse 2 líneas");

    const salesLine = lines.find(
      (l) => l.accountCode === ACCOUNTING_ACCOUNT_CODES.salesRevenueNonTaxable,
    );
    const ivaLine = lines.find(
      (l) => l.accountCode === ACCOUNTING_ACCOUNT_CODES.ivaPayable,
    );

    assert.ok(salesLine, "debe usar cuenta de ventas no gravadas");
    assert.equal(salesLine.credit, "500.00");
    assert.equal(ivaLine, undefined, "no debe generarse línea de IVA");

    const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);

    assert.ok(
      Math.abs(totalDebit - totalCredit) < 0.01,
      `asiento debe balancear: ${totalDebit} vs ${totalCredit}`,
    );
  });
});
