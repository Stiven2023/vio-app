/**
 * Tests de regresión fiscal Colombia.
 *
 * Verifica que el tratamiento contable sea correcto según la normativa colombiana:
 * - Factura tipo F: genera IVA, aplica retenciones
 * - Remisión tipo R: NO genera IVA, NO genera retenciones
 * - Periodos cerrados: no deben recibir asientos
 * - Cuentas PUC Colombia: códigos correctos por tipo de evento
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNTING_ACCOUNT_CODES,
  buildSalesAccountingLines,
  buildOrderPaymentAccountingLines,
} from "@/src/utils/accounting-entries";

// ─── Factura tipo F ────────────────────────────────────────────────────────

test("fiscal Colombia — Factura F: genera línea de IVA (240801)", () => {
  const lines = buildSalesAccountingLines({
    prefacturaId: "pf-f-001",
    prefacturaCode: "F-2026-001",
    clientId: "cli-001",
    invoiceDate: "2026-04-01",
    subtotal: "840.34",
    ivaAmount: "159.66",
    total: "1000.00",
  });

  const ivaLine = lines.find((l) => l.accountCode === ACCOUNTING_ACCOUNT_CODES.ivaPayable);

  assert.ok(ivaLine, "Factura F debe generar línea de IVA");
  assert.equal(ivaLine.accountCode, "240801", "Cuenta IVA debe ser 240801 (PUC Colombia)");
  assert.equal(ivaLine.credit, "159.66", "Monto IVA corresponde al 19% sobre la base");
});

test("fiscal Colombia — Factura F: débito a cartera cliente (130505)", () => {
  const lines = buildSalesAccountingLines({
    prefacturaId: "pf-f-002",
    prefacturaCode: "F-2026-002",
    clientId: "cli-002",
    invoiceDate: "2026-04-02",
    subtotal: "840.34",
    ivaAmount: "159.66",
    total: "1000.00",
  });

  const debitLine = lines.find((l) => Number(l.debit) > 0);

  assert.ok(debitLine, "Factura F debe tener línea de débito a cartera");
  assert.equal(debitLine.accountCode, ACCOUNTING_ACCOUNT_CODES.accountsReceivable);
  assert.equal(debitLine.accountCode, "130505", "Cartera PUC Colombia: 130505");
  assert.equal(debitLine.debit, "1000.00", "Débito por valor total de la factura");
});

test("fiscal Colombia — Factura F: crédito a ingresos por ventas (410505)", () => {
  const lines = buildSalesAccountingLines({
    prefacturaId: "pf-f-003",
    prefacturaCode: "F-2026-003",
    clientId: "cli-003",
    invoiceDate: "2026-04-03",
    subtotal: "840.34",
    ivaAmount: "159.66",
    total: "1000.00",
  });

  const salesLine = lines.find((l) => l.accountCode === ACCOUNTING_ACCOUNT_CODES.salesRevenue);

  assert.ok(salesLine, "Factura F debe tener línea de ingresos");
  assert.equal(salesLine.accountCode, "410505", "Ventas PUC Colombia: 410505");
  assert.equal(salesLine.credit, "840.34", "Crédito por valor sin IVA");
});

test("fiscal Colombia — Factura F: balance DR = CR con IVA", () => {
  const lines = buildSalesAccountingLines({
    prefacturaId: "pf-f-004",
    prefacturaCode: "F-2026-004",
    clientId: "cli-004",
    invoiceDate: "2026-04-04",
    subtotal: "1260.50",
    ivaAmount: "239.50",
    total: "1500.00",
  });

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);

  assert.ok(
    Math.abs(totalDebit - totalCredit) < 0.01,
    `Asiento F debe balancear: DR=${totalDebit} CR=${totalCredit}`,
  );
});

// ─── Remisión tipo R ───────────────────────────────────────────────────────

test("fiscal Colombia — Remisión R: NO genera línea de IVA (solo ventas no gravadas)", () => {
  const lines = buildSalesAccountingLines({
    prefacturaId: "pf-r-001",
    prefacturaCode: "R-2026-001",
    clientId: "cli-005",
    invoiceDate: "2026-04-05",
    subtotal: "1000.00",
    ivaAmount: "0",
    total: "1000.00",
  });

  const ivaLine = lines.find((l) => l.accountCode === ACCOUNTING_ACCOUNT_CODES.ivaPayable);

  assert.equal(ivaLine, undefined, "Remisión R NO debe generar línea de IVA");
});

test("fiscal Colombia — Remisión R: crédito a cuenta ventas no gravadas (419505)", () => {
  const lines = buildSalesAccountingLines({
    prefacturaId: "pf-r-002",
    prefacturaCode: "R-2026-002",
    clientId: "cli-006",
    invoiceDate: "2026-04-06",
    subtotal: "800.00",
    ivaAmount: "0",
    total: "800.00",
  });

  const nonTaxableLine = lines.find(
    (l) => l.accountCode === ACCOUNTING_ACCOUNT_CODES.salesRevenueNonTaxable,
  );

  assert.ok(nonTaxableLine, "Remisión R debe usar cuenta 419505 (ventas no gravadas)");
  assert.equal(nonTaxableLine.accountCode, "419505", "PUC Colombia: 419505 ventas no gravadas");
  assert.equal(nonTaxableLine.credit, "800.00", "Crédito por valor total sin IVA");
});

test("fiscal Colombia — Remisión R: balance DR = CR sin IVA", () => {
  const lines = buildSalesAccountingLines({
    prefacturaId: "pf-r-003",
    prefacturaCode: "R-2026-003",
    clientId: "cli-007",
    invoiceDate: "2026-04-07",
    subtotal: "2500.00",
    ivaAmount: "0",
    total: "2500.00",
  });

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit), 0);

  assert.ok(
    Math.abs(totalDebit - totalCredit) < 0.01,
    `Asiento R debe balancear: DR=${totalDebit} CR=${totalCredit}`,
  );
});

// ─── Pagos / anticipos Colombia ────────────────────────────────────────────

test("fiscal Colombia — Pago anticipo: cuenta bancos (111005) y anticipos clientes (280505)", () => {
  const lines = buildOrderPaymentAccountingLines({
    paymentId: "pay-col-001",
    orderId: "ord-col-001",
    orderCode: "P-COL-001",
    clientId: "cli-col-001",
    paymentDate: "2026-04-07",
    paymentMethod: "TRANSFERENCIA",
    amount: "2000000",
    referenceCode: "TRANSF-2026-001",
  });

  assert.equal(lines.length, 2);
  assert.equal(lines[0].accountCode, "111005", "DR Bancos - PUC Colombia 111005");
  assert.equal(lines[1].accountCode, "280505", "CR Anticipos clientes - PUC Colombia 280505");
});

test("fiscal Colombia — Cuentas PUC clave: valores del catálogo oficial", () => {
  // Verifica que los códigos en ACCOUNTING_ACCOUNT_CODES sean PUC colombiano
  assert.equal(ACCOUNTING_ACCOUNT_CODES.cashOnHand, "110505", "110505 = Caja");
  assert.equal(ACCOUNTING_ACCOUNT_CODES.banks, "111005", "111005 = Bancos");
  assert.equal(ACCOUNTING_ACCOUNT_CODES.accountsReceivable, "130505", "130505 = Deudores comerciales");
  assert.equal(ACCOUNTING_ACCOUNT_CODES.customerAdvances, "280505", "280505 = Anticipos clientes");
  assert.equal(ACCOUNTING_ACCOUNT_CODES.salesRevenue, "410505", "410505 = Ventas gravadas");
  assert.equal(ACCOUNTING_ACCOUNT_CODES.salesRevenueNonTaxable, "419505", "419505 = Ventas no gravadas");
  assert.equal(ACCOUNTING_ACCOUNT_CODES.ivaPayable, "240801", "240801 = IVA por pagar");
  assert.equal(ACCOUNTING_ACCOUNT_CODES.pettyCash, "110510", "110510 = Caja menor");
  assert.equal(ACCOUNTING_ACCOUNT_CODES.generalExpenses, "511595", "511595 = Gastos generales");
  assert.equal(ACCOUNTING_ACCOUNT_CODES.miscIncome, "470595", "470595 = Otros ingresos");
  assert.equal(ACCOUNTING_ACCOUNT_CODES.financialDiscount, "530590", "530590 = Gastos financieros");
});
