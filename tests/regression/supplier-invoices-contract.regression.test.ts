import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { createSupplierInvoiceSchema } from "@/src/utils/supplier-invoices-contract";

test("supplier-invoice contract: payload válido con motor tributario", () => {
  const parsed = createSupplierInvoiceSchema.safeParse({
    supplierId: "550e8400-e29b-41d4-a716-446655440001",
    purchaseOrderId: "550e8400-e29b-41d4-a716-446655440002",
    invoiceDate: "2025-06-01",
    subtotal: 1000000,
    operationType: "PURCHASE",
    customerProfile: "WITHHOLDING_AGENT",
  });

  assert.equal(parsed.success, true, "Debe aceptar payload con motor tributario");
  if (parsed.success) {
    assert.strictEqual(parsed.data.operationType, "PURCHASE");
    assert.strictEqual(parsed.data.customerProfile, "WITHHOLDING_AGENT");
    assert.strictEqual(parsed.data.ivaRate, 19);
  }
});

test("supplier-invoice contract: payload válido sin motor (compatibilidad atrás)", () => {
  const parsed = createSupplierInvoiceSchema.safeParse({
    supplierId: "550e8400-e29b-41d4-a716-446655440001",
    purchaseOrderId: "550e8400-e29b-41d4-a716-446655440002",
    invoiceDate: "2025-06-01",
    subtotal: 1000000,
    ivaAmount: 190000,
    withholdingTax: 25000,
    withholdingIva: 0,
    withholdingIca: 0,
  });

  assert.equal(parsed.success, true, "Debe aceptar payload manual sin motor");
  if (parsed.success) {
    assert.strictEqual(parsed.data.ivaAmount, 190000);
    assert.strictEqual(parsed.data.withholdingTax, 25000);
  }
});

test("supplier-invoice contract: rechaza operationType sin customerProfile", () => {
  const parsed = createSupplierInvoiceSchema.safeParse({
    supplierId: "550e8400-e29b-41d4-a716-446655440001",
    purchaseOrderId: "550e8400-e29b-41d4-a716-446655440002",
    invoiceDate: "2025-06-01",
    subtotal: 1000000,
    operationType: "PURCHASE",
    // customerProfile falta
  });

  assert.equal(parsed.success, false, "Debe rechazar sin customerProfile");
  if (!parsed.success) {
    const customerProfileError = parsed.error.issues.find(
      (issue) => issue.code === "custom"
    );
    assert.ok(
      customerProfileError,
      "Debe indicar que customerProfile es obligatorio con operationType"
    );
  }
});

test("supplier-invoice contract: rechaza customerProfile sin operationType", () => {
  const parsed = createSupplierInvoiceSchema.safeParse({
    supplierId: "550e8400-e29b-41d4-a716-446655440001",
    purchaseOrderId: "550e8400-e29b-41d4-a716-446655440002",
    invoiceDate: "2025-06-01",
    subtotal: 1000000,
    customerProfile: "WITHHOLDING_AGENT",
    // operationType falta
  });

  assert.equal(parsed.success, false, "Debe rechazar sin operationType");
  if (!parsed.success) {
    const customError = parsed.error.issues.find((issue) => issue.code === "custom");
    assert.ok(customError, "Debe indicar el error de pareja obligatoria");
  }
});

test("supplier-invoice contract: rechaza fecha inválida", () => {
  const parsed = createSupplierInvoiceSchema.safeParse({
    supplierId: "550e8400-e29b-41d4-a716-446655440001",
    purchaseOrderId: "550e8400-e29b-41d4-a716-446655440002",
    invoiceDate: "06-01-2025", // formato inválido
    subtotal: 1000000,
    ivaAmount: 190000,
  });

  assert.equal(parsed.success, false, "Debe rechazar fecha inválida");
  if (!parsed.success) {
    const dateError = parsed.error.issues.find((issue) =>
      issue.path.includes("invoiceDate")
    );
    assert.ok(dateError, "Debe indicar error en invoiceDate");
  }
});

test("supplier-invoice contract: rechaza subtotal negativo", () => {
  const parsed = createSupplierInvoiceSchema.safeParse({
    supplierId: "550e8400-e29b-41d4-a716-446655440001",
    purchaseOrderId: "550e8400-e29b-41d4-a716-446655440002",
    invoiceDate: "2025-06-01",
    subtotal: -1000,
    ivaAmount: 190000,
  });

  assert.equal(parsed.success, false, "Debe rechazar subtotal negativo");
  if (!parsed.success) {
    const subtotalError = parsed.error.issues.find((issue) =>
      issue.path.includes("subtotal")
    );
    assert.ok(subtotalError, "Debe indicar error en subtotal");
  }
});

test("supplier-invoice contract: rechaza UUID inválido para supplierId", () => {
  const parsed = createSupplierInvoiceSchema.safeParse({
    supplierId: "not-a-uuid",
    purchaseOrderId: "550e8400-e29b-41d4-a716-446655440002",
    invoiceDate: "2025-06-01",
    subtotal: 1000000,
    ivaAmount: 190000,
  });

  assert.equal(parsed.success, false, "Debe rechazar supplierId inválido");
  if (!parsed.success) {
    const supplierError = parsed.error.issues.find((issue) =>
      issue.path.includes("supplierId")
    );
    assert.ok(supplierError, "Debe indicar error en supplierId");
  }
});

test("supplier-invoice contract: aplica defaults para currency y ivaRate", () => {
  const parsed = createSupplierInvoiceSchema.safeParse({
    supplierId: "550e8400-e29b-41d4-a716-446655440001",
    purchaseOrderId: "550e8400-e29b-41d4-a716-446655440002",
    invoiceDate: "2025-06-01",
    subtotal: 1000000,
    operationType: "PURCHASE",
    customerProfile: "WITHHOLDING_AGENT",
    // currency y ivaRate no proporcionados
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.strictEqual(parsed.data.currency, "COP", "Currency debe defaultear a COP");
    assert.strictEqual(parsed.data.ivaRate, 19, "ivaRate debe defaultear a 19");
  }
});

test("supplier-invoice contract: acepta documentUrl válida", () => {
  const parsed = createSupplierInvoiceSchema.safeParse({
    supplierId: "550e8400-e29b-41d4-a716-446655440001",
    purchaseOrderId: "550e8400-e29b-41d4-a716-446655440002",
    invoiceDate: "2025-06-01",
    subtotal: 1000000,
    ivaAmount: 190000,
    documentUrl: "https://example.com/invoice.pdf",
  });

  assert.equal(parsed.success, true, "Debe aceptar URL válida");
});

test("supplier-invoice contract: rechaza documentUrl inválida", () => {
  const parsed = createSupplierInvoiceSchema.safeParse({
    supplierId: "550e8400-e29b-41d4-a716-446655440001",
    purchaseOrderId: "550e8400-e29b-41d4-a716-446655440002",
    invoiceDate: "2025-06-01",
    subtotal: 1000000,
    ivaAmount: 190000,
    documentUrl: "not-a-url",
  });

  assert.equal(parsed.success, false, "Debe rechazar URL inválida");
  if (!parsed.success) {
    const urlError = parsed.error.issues.find((issue) =>
      issue.path.includes("documentUrl")
    );
    assert.ok(urlError, "Debe indicar error en documentUrl");
  }
});
