import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import {
  ACCOUNTING_ACCOUNT_CODES,
  postHcmPreAsientoEntry,
} from "@/src/utils/accounting-entries";

test("hcm integración db: transición APROBADO -> CONTABILIZADO con asiento real", async (t) => {
  const erpDbUrl = process.env.ERP_DATABASE_URL?.trim();

  if (!erpDbUrl) {
    t.skip(
      "ERP_DATABASE_URL no está configurado para prueba de integración real.",
    );
    return;
  }

  const [{ db }, erpSchema, accountingSchema] = await Promise.all([
    import("@/src/db"),
    import("@/src/db/erp/schema"),
    import("@/src/db/schema"),
  ]);

  const { employees, hcmPreAsientos } = erpSchema;
  const { accountingAccounts, accountingEntries } = accountingSchema;

  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.isActive, true))
    .limit(1);

  if (!employee?.id) {
    t.skip("No hay empleados activos para validar integración HCM real.");
    return;
  }

  const requiredCodes = [
    ACCOUNTING_ACCOUNT_CODES.cashOnHand,
    ACCOUNTING_ACCOUNT_CODES.accountsReceivable,
  ];

  const accountRows = await db
    .select({ code: accountingAccounts.code })
    .from(accountingAccounts)
    .where(
      and(
        inArray(accountingAccounts.code, requiredCodes),
        eq(accountingAccounts.isActive, true),
        eq(accountingAccounts.isPostable, true),
      ),
    );

  if (accountRows.length < requiredCodes.length) {
    t.skip(
      `Faltan cuentas contables activas/postables para integrar: ${requiredCodes.join(", ")}.`,
    );
    return;
  }

  const testTag = randomUUID();
  const preAsientoId = randomUUID();
  let entryId: string | null = null;

  try {
    await db.insert(hcmPreAsientos).values({
      id: preAsientoId,
      origen: "integration_test",
      origenId: randomUUID(),
      employeeId: employee.id,
      period: "2026-04",
      cuentaDebito: ACCOUNTING_ACCOUNT_CODES.cashOnHand,
      cuentaCredito: ACCOUNTING_ACCOUNT_CODES.accountsReceivable,
      valor: "10000.00",
      concepto: `Integración HCM ${testTag}`,
      status: "APROBADO",
      aprobadoPor: employee.id,
      aprobadoEn: new Date(),
    });

    const entry = await db.transaction(async (tx) => {
      const postedEntry = await postHcmPreAsientoEntry(
        tx,
        {
          preAsientoId,
          period: "2026-04",
          entryDate: "2026-04-01",
          employeeId: employee.id,
          accountDebitCode: ACCOUNTING_ACCOUNT_CODES.cashOnHand,
          accountCreditCode: ACCOUNTING_ACCOUNT_CODES.accountsReceivable,
          amount: "10000.00",
          concept: `Integración HCM ${testTag}`,
        },
        null,
      );

      await tx
        .update(hcmPreAsientos)
        .set({
          status: "CONTABILIZADO",
          accountingEntryId: postedEntry.id,
          updatedAt: new Date(),
        })
        .where(eq(hcmPreAsientos.id, preAsientoId));

      return postedEntry;
    });

    entryId = entry.id;

    const [updatedPreAsiento] = await db
      .select({
        id: hcmPreAsientos.id,
        status: hcmPreAsientos.status,
        accountingEntryId: hcmPreAsientos.accountingEntryId,
      })
      .from(hcmPreAsientos)
      .where(eq(hcmPreAsientos.id, preAsientoId))
      .limit(1);

    assert.ok(updatedPreAsiento, "El pre-asiento de prueba debe existir");
    assert.equal(updatedPreAsiento.status, "CONTABILIZADO");
    assert.equal(updatedPreAsiento.accountingEntryId, entry.id);

    const [persistedEntry] = await db
      .select({
        id: accountingEntries.id,
        sourceType: accountingEntries.sourceType,
        sourceId: accountingEntries.sourceId,
        status: accountingEntries.status,
      })
      .from(accountingEntries)
      .where(eq(accountingEntries.id, entry.id))
      .limit(1);

    assert.ok(persistedEntry, "Debe existir el asiento contable generado");
    assert.equal(persistedEntry.sourceType, "HCM_PRE_ASIENTO");
    assert.equal(persistedEntry.sourceId, preAsientoId);
    assert.equal(persistedEntry.status, "POSTED");
  } finally {
    if (entryId) {
      await db
        .delete(accountingEntries)
        .where(eq(accountingEntries.id, entryId));
    }

    await db.delete(hcmPreAsientos).where(eq(hcmPreAsientos.id, preAsientoId));
  }
});
