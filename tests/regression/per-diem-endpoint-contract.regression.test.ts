import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";
import { zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  createPerDiemSchema,
  perDiemListQuerySchema,
} from "@/src/utils/per-diem-contract";

test("per-diem contract: acepta payload valido", () => {
  const parsed = createPerDiemSchema.safeParse({
    supportInvoiceUrl: "https://files.viomar.test/viaticos/factura-001.pdf",
    supportInvoiceNumber: "FV-001",
    amount: 450000,
    expenseType: "TRAVEL",
    tripStartDate: "2026-04-07",
    tripEndDate: "2026-04-08",
  });

  assert.equal(parsed.success, true);
});

test("per-diem contract: rechaza fecha final menor", async () => {
  const parsed = createPerDiemSchema.safeParse({
    supportInvoiceUrl: "https://files.viomar.test/viaticos/factura-001.pdf",
    amount: 450000,
    expenseType: "TRAVEL",
    tripStartDate: "2026-04-08",
    tripEndDate: "2026-04-07",
  });

  assert.equal(parsed.success, false);
  if (parsed.success) return;

  const response = zodFirstErrorEnvelope(
    parsed.error,
    "Datos invalidos para registrar viaticos.",
  );
  const payload = await response.json();

  assertStatus(response.status, 400);
  assertErrorEnvelopeShape(payload);
  assertFieldError(payload, "tripEndDate", "final");
});

test("per-diem list query: defaults consistentes", () => {
  const parsed = perDiemListQuerySchema.parse({});

  assert.equal(parsed.page, 1);
  assert.equal(parsed.pageSize, 20);
});
