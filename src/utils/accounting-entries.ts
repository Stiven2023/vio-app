import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  accountingAccounts,
  accountingEntries,
  accountingEntryHistory,
  accountingEntryLines,
  accountingPeriods,
  cashReceiptApplications,
  cashReceipts,
  prefacturas,
} from "@/src/db/schema";
import { parseAccountingPeriod } from "@/src/utils/accounting-period";

export const ACCOUNTING_ACCOUNT_CODES = {
  cashOnHand: "110505",
  banks: "111005",
  accountsReceivable: "130505",
  customerAdvances: "280505",
  salesRevenue: "410505",
  salesRevenueNonTaxable: "419505",
  ivaPayable: "240801",
  // Purchases / costs
  rawMaterials: "143505",      // Inventario materia prima (ASSET)
  grni: "190590",              // Mercancía en tránsito / GRNI (puente)
  accountsPayable: "220505",   // Cuentas por pagar proveedores (LIABILITY)
  confectionistLabor: "623505",// Mano de obra confección (COST)
  packerLabor: "623510",       // Mano de obra empaque (COST)
} as const;

type CashReceiptPostingInput = {
  receiptId: string;
  receiptCode: string;
  clientId: string;
  receiptDate: string;
  paymentMethod: string;
  amountReceived: string | number;
  creditBalance: string | number | null;
  notes?: string | null;
  applications: Array<{
    prefacturaId: string | null;
    prefacturaCode?: string | null;
    appliedAmount: string | number;
  }>;
};

export type AccountingLineDraft = {
  accountCode: string;
  debit: string;
  credit: string;
  description: string;
    thirdPartyType?: "EMPLEADO" | "CLIENTE" | "CONFECCIONISTA" | "PROVEEDOR" | "EMPAQUE";
  thirdPartyId?: string | null;
  metadata?: Record<string, unknown>;
};

class AccountingConfigurationError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]>) {
    super(message);
    this.name = "AccountingConfigurationError";
    this.fieldErrors = fieldErrors;
  }
}

function toMoneyNumber(value: string | number | null | undefined) {
  const normalized = Number(String(value ?? "0"));

  return Number.isFinite(normalized) ? normalized : 0;
}

function toMoneyString(value: number) {
  return value.toFixed(2);
}

function getReceiptTreasuryAccountCode(paymentMethod: string) {
  const normalized = String(paymentMethod ?? "").trim().toUpperCase();

  return normalized === "EFECTIVO"
    ? ACCOUNTING_ACCOUNT_CODES.cashOnHand
    : ACCOUNTING_ACCOUNT_CODES.banks;
}

export function buildCashReceiptAccountingLines(
  input: CashReceiptPostingInput,
): AccountingLineDraft[] {
  const totalReceived = toMoneyNumber(input.amountReceived);
  const appliedAmount = input.applications.reduce(
    (sum, application) => sum + toMoneyNumber(application.appliedAmount),
    0,
  );
  const creditBalance = Math.max(
    0,
    toMoneyNumber(input.creditBalance) || totalReceived - appliedAmount,
  );

  const lines: AccountingLineDraft[] = [
    {
      accountCode: getReceiptTreasuryAccountCode(input.paymentMethod),
      debit: toMoneyString(totalReceived),
      credit: "0.00",
      description: `Cobro recibido ${input.receiptCode}`,
      thirdPartyType: "CLIENTE",
      thirdPartyId: input.clientId,
      metadata: {
        receiptId: input.receiptId,
        paymentMethod: input.paymentMethod,
      },
    },
  ];

  if (appliedAmount > 0) {
    lines.push({
      accountCode: ACCOUNTING_ACCOUNT_CODES.accountsReceivable,
      debit: "0.00",
      credit: toMoneyString(appliedAmount),
      description: `Aplicación a cartera ${input.receiptCode}`,
      thirdPartyType: "CLIENTE",
      thirdPartyId: input.clientId,
      metadata: {
        receiptId: input.receiptId,
        prefacturas: input.applications.map((application) => ({
          prefacturaId: application.prefacturaId,
          prefacturaCode: application.prefacturaCode ?? null,
          appliedAmount: toMoneyString(toMoneyNumber(application.appliedAmount)),
        })),
      },
    });
  }

  if (creditBalance > 0) {
    lines.push({
      accountCode: ACCOUNTING_ACCOUNT_CODES.customerAdvances,
      debit: "0.00",
      credit: toMoneyString(creditBalance),
      description: `Anticipo de cliente ${input.receiptCode}`,
      thirdPartyType: "CLIENTE",
      thirdPartyId: input.clientId,
      metadata: {
        receiptId: input.receiptId,
        creditBalance: toMoneyString(creditBalance),
      },
    });
  }

  return lines;
}

async function ensureAccountingPeriodExists(
  tx: any,
  period: string,
  employeeId: string | null,
) {
  const [existing] = await tx
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(eq(accountingPeriods.period, period))
    .limit(1);

  if (existing?.id) return;

  await tx.insert(accountingPeriods).values({
    period,
    status: "OPEN",
    openedBy: employeeId,
  });
}

async function resolveAccountsByCode(tx: any, accountCodes: string[]) {
  const rows: Array<{
    id: string;
    code: string;
    isActive: boolean | null;
    isPostable: boolean | null;
  }> = await tx
    .select({
      id: accountingAccounts.id,
      code: accountingAccounts.code,
      isActive: accountingAccounts.isActive,
      isPostable: accountingAccounts.isPostable,
    })
    .from(accountingAccounts)
    .where(inArray(accountingAccounts.code, accountCodes));

  const byCode = new Map<string, (typeof rows)[number]>(
    rows.map((row) => [row.code, row]),
  );
  const missing = accountCodes.filter((code) => !byCode.has(code));

  if (missing.length > 0) {
    throw new AccountingConfigurationError(
      "Faltan cuentas contables obligatorias para registrar el cobro.",
      {
        accounting: [
          `Configura las cuentas contables: ${missing.join(", ")}.`,
        ],
      },
    );
  }

  const invalid = rows.filter(
    (row) => row.isActive !== true || row.isPostable !== true,
  );

  if (invalid.length > 0) {
    throw new AccountingConfigurationError(
      "Una o más cuentas contables no están activas o no permiten movimientos.",
      {
        accounting: invalid.map(
          (row) => `La cuenta ${row.code} debe estar activa y ser postable.`,
        ),
      },
    );
  }

  return byCode;
}

async function generateAccountingEntryNumber(tx: any, period: string) {
  const compactPeriod = period.replace("-", "");
  const prefix = `ASI-${compactPeriod}-`;
  const [row] = await tx
    .select({
      maxSuffix: sql<number>`max((substring(${accountingEntries.entryNumber} from '(?i)^ASI-[0-9]{6}-([0-9]+)$')::int))`,
    })
    .from(accountingEntries)
    .where(sql`${accountingEntries.entryNumber} ilike ${`${prefix}%`}`)
    .limit(1);

  const next = (row?.maxSuffix ?? 0) + 1;

  return `${prefix}${String(next).padStart(6, "0")}`;
}

export async function postCashReceiptAccountingEntry(
  tx: any,
  input: CashReceiptPostingInput,
  employeeId: string | null,
) {
  const period = parseAccountingPeriod(String(input.receiptDate).slice(0, 7));

  if (!period) {
    throw new AccountingConfigurationError(
      "La fecha del recibo no permite determinar un período contable válido.",
      {
        receiptDate: ["La fecha del recibo debe pertenecer a un período YYYY-MM válido."],
      },
    );
  }

  await ensureAccountingPeriodExists(tx, period, employeeId);

  const idempotencyKey = `cash-receipt:confirm:${input.receiptId}`;
  const [existingEntry] = await tx
    .select({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber })
    .from(accountingEntries)
    .where(eq(accountingEntries.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingEntry?.id) return existingEntry;

  const lines = buildCashReceiptAccountingLines(input);
  const accountCodes = Array.from(new Set(lines.map((line) => line.accountCode)));
  const accountsByCode = await resolveAccountsByCode(tx, accountCodes);

  const totalDebit = lines.reduce((sum, line) => sum + toMoneyNumber(line.debit), 0);
  const totalCredit = lines.reduce((sum, line) => sum + toMoneyNumber(line.credit), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001 || totalDebit <= 0) {
    throw new AccountingConfigurationError(
      "El asiento generado para el cobro no está balanceado.",
      {
        accounting: ["Revisa la composición del asiento del recibo de caja."],
      },
    );
  }

  const entryNumber = await generateAccountingEntryNumber(tx, period);

  const [entry] = await tx
    .insert(accountingEntries)
    .values({
      entryNumber,
      period,
      entryDate: input.receiptDate,
      status: "POSTED",
      sourceModule: "TREASURY",
      sourceType: "CASH_RECEIPT",
      sourceId: input.receiptId,
      idempotencyKey,
      description: `Recibo de caja ${input.receiptCode}`,
      externalReference: input.receiptCode,
      postedAt: new Date(),
      postedBy: employeeId,
      metadata: {
        receiptId: input.receiptId,
        clientId: input.clientId,
      },
      createdBy: employeeId,
    })
    .returning({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber });

  await tx.insert(accountingEntryLines).values(
    lines.map((line, index) => ({
      entryId: entry.id,
      accountId: accountsByCode.get(line.accountCode)?.id,
      thirdPartyType: line.thirdPartyType ?? null,
      thirdPartyId: line.thirdPartyId ?? null,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
      lineOrder: index + 1,
      metadata: line.metadata ?? null,
    })),
  );

  await tx.insert(accountingEntryHistory).values({
    entryId: entry.id,
    action: "POSTED_FROM_CASH_RECEIPT",
    notes: `Asiento generado automáticamente para ${input.receiptCode}.`,
    payload: {
      receiptId: input.receiptId,
      applications: input.applications.length,
    },
    performedBy: employeeId,
  });

  return entry;
}

export async function reverseCashReceiptAccountingEntry(
  tx: any,
  args: {
    receiptId: string;
    receiptCode: string;
    voidDate: string;
    employeeId: string | null;
  },
) {
  const [originalEntry] = await tx
    .select({
      id: accountingEntries.id,
      entryNumber: accountingEntries.entryNumber,
      period: accountingEntries.period,
      status: accountingEntries.status,
    })
    .from(accountingEntries)
    .where(eq(accountingEntries.idempotencyKey, `cash-receipt:confirm:${args.receiptId}`))
    .limit(1);

  if (!originalEntry?.id || String(originalEntry.status) === "REVERSED") {
    return null;
  }

  const reversalIdempotencyKey = `cash-receipt:void:${args.receiptId}`;
  const [existingReversal] = await tx
    .select({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber })
    .from(accountingEntries)
    .where(eq(accountingEntries.idempotencyKey, reversalIdempotencyKey))
    .limit(1);

  if (existingReversal?.id) return existingReversal;

  await ensureAccountingPeriodExists(tx, originalEntry.period, args.employeeId);

  const originalLines: Array<{
    accountId: string;
    thirdPartyType:
      | "EMPLEADO"
      | "CLIENTE"
      | "CONFECCIONISTA"
      | "PROVEEDOR"
      | "EMPAQUE"
      | null;
    thirdPartyId: string | null;
    description: string | null;
    debit: string;
    credit: string;
    lineOrder: number;
    metadata: Record<string, unknown> | null;
  }> = await tx
    .select({
      accountId: accountingEntryLines.accountId,
      thirdPartyType: accountingEntryLines.thirdPartyType,
      thirdPartyId: accountingEntryLines.thirdPartyId,
      description: accountingEntryLines.description,
      debit: accountingEntryLines.debit,
      credit: accountingEntryLines.credit,
      lineOrder: accountingEntryLines.lineOrder,
      metadata: accountingEntryLines.metadata,
    })
    .from(accountingEntryLines)
    .where(eq(accountingEntryLines.entryId, originalEntry.id))
    .orderBy(asc(accountingEntryLines.lineOrder));

  const reversalEntryNumber = await generateAccountingEntryNumber(
    tx,
    originalEntry.period,
  );

  const [reversalEntry] = await tx
    .insert(accountingEntries)
    .values({
      entryNumber: reversalEntryNumber,
      period: originalEntry.period,
      entryDate: args.voidDate,
      status: "POSTED",
      sourceModule: "TREASURY",
      sourceType: "CASH_RECEIPT_VOID",
      sourceId: args.receiptId,
      idempotencyKey: reversalIdempotencyKey,
      description: `Reversión recibo de caja ${args.receiptCode}`,
      externalReference: args.receiptCode,
      postedAt: new Date(),
      postedBy: args.employeeId,
      reversalOfId: originalEntry.id,
      metadata: {
        receiptId: args.receiptId,
        reversalOfEntryNumber: originalEntry.entryNumber,
      },
      createdBy: args.employeeId,
    })
    .returning({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber });

  await tx.insert(accountingEntryLines).values(
    originalLines.map((line) => ({
      entryId: reversalEntry.id,
      accountId: line.accountId,
      thirdPartyType: line.thirdPartyType,
      thirdPartyId: line.thirdPartyId,
      description: `Reversión ${line.description ?? ""}`.trim(),
      debit: String(line.credit ?? "0"),
      credit: String(line.debit ?? "0"),
      lineOrder: line.lineOrder,
      metadata: line.metadata,
    })),
  );

  await tx
    .update(accountingEntries)
    .set({
      status: "REVERSED",
      reversedAt: new Date(),
      reversedBy: args.employeeId,
    })
    .where(eq(accountingEntries.id, originalEntry.id));

  await tx.insert(accountingEntryHistory).values([
    {
      entryId: originalEntry.id,
      action: "REVERSED_FROM_CASH_RECEIPT_VOID",
      notes: `Asiento revertido por anulación del recibo ${args.receiptCode}.`,
      payload: { receiptId: args.receiptId, reversalEntryId: reversalEntry.id },
      performedBy: args.employeeId,
    },
    {
      entryId: reversalEntry.id,
      action: "CREATED_AS_REVERSAL",
      notes: `Reversión automática del recibo ${args.receiptCode}.`,
      payload: { receiptId: args.receiptId, originalEntryId: originalEntry.id },
      performedBy: args.employeeId,
    },
  ]);

  return reversalEntry;
}

export async function getCashReceiptPostingPayload(tx: any, receiptId: string) {
  const [receipt] = await tx
    .select({
      id: cashReceipts.id,
      receiptCode: cashReceipts.receiptCode,
      clientId: cashReceipts.clientId,
      receiptDate: cashReceipts.receiptDate,
      amountReceived: cashReceipts.amountReceived,
      paymentMethod: cashReceipts.paymentMethod,
      creditBalance: cashReceipts.creditBalance,
      notes: cashReceipts.notes,
    })
    .from(cashReceipts)
    .where(eq(cashReceipts.id, receiptId))
    .limit(1);

  if (!receipt?.id) return null;

  const applications = await tx
    .select({
      prefacturaId: cashReceiptApplications.prefacturaId,
      prefacturaCode: prefacturas.prefacturaCode,
      appliedAmount: cashReceiptApplications.appliedAmount,
    })
    .from(cashReceiptApplications)
    .leftJoin(
      prefacturas,
      eq(cashReceiptApplications.prefacturaId, prefacturas.id),
    )
    .where(eq(cashReceiptApplications.cashReceiptId, receiptId));

  return {
    receiptId: receipt.id,
    receiptCode: receipt.receiptCode,
    clientId: receipt.clientId,
    receiptDate: String(receipt.receiptDate),
    amountReceived: String(receipt.amountReceived ?? "0"),
    paymentMethod: String(receipt.paymentMethod ?? "EFECTIVO"),
    creditBalance: receipt.creditBalance,
    notes: receipt.notes,
    applications,
  } satisfies CashReceiptPostingInput;
}

export function isAccountingConfigurationError(error: unknown) {
  return error instanceof AccountingConfigurationError;
}

export function getAccountingConfigurationFieldErrors(error: unknown) {
  return error instanceof AccountingConfigurationError ? error.fieldErrors : undefined;
}

// ── Sales recognition ─────────────────────────────────────────────────────────

export type SalesPostingInput = {
  prefacturaId: string;
  prefacturaCode: string;
  clientId: string;
  invoiceDate: string; // YYYY-MM-DD
  subtotal: string | number;
  ivaAmount: string | number;
  total: string | number;
};

export function buildSalesAccountingLines(
  input: SalesPostingInput,
): AccountingLineDraft[] {
  const subtotal = toMoneyNumber(input.subtotal);
  const ivaAmount = toMoneyNumber(input.ivaAmount);
  const total = toMoneyNumber(input.total);
  const hasTax = ivaAmount > 0.001;

  const lines: AccountingLineDraft[] = [
    {
      accountCode: ACCOUNTING_ACCOUNT_CODES.accountsReceivable,
      debit: toMoneyString(total),
      credit: "0.00",
      description: `Venta facturada ${input.prefacturaCode}`,
      thirdPartyType: "CLIENTE",
      thirdPartyId: input.clientId,
      metadata: { prefacturaId: input.prefacturaId },
    },
    {
      accountCode: hasTax
        ? ACCOUNTING_ACCOUNT_CODES.salesRevenue
        : ACCOUNTING_ACCOUNT_CODES.salesRevenueNonTaxable,
      debit: "0.00",
      credit: toMoneyString(hasTax ? subtotal : total),
      description: `Ingreso por venta ${input.prefacturaCode}`,
      thirdPartyType: "CLIENTE",
      thirdPartyId: input.clientId,
      metadata: { prefacturaId: input.prefacturaId },
    },
  ];

  if (hasTax) {
    lines.push({
      accountCode: ACCOUNTING_ACCOUNT_CODES.ivaPayable,
      debit: "0.00",
      credit: toMoneyString(ivaAmount),
      description: `IVA generado ${input.prefacturaCode}`,
      metadata: { prefacturaId: input.prefacturaId },
    });
  }

  return lines;
}

export async function postSalesAccountingEntry(
  tx: any,
  input: SalesPostingInput,
  employeeId: string | null,
) {
  const period = parseAccountingPeriod(String(input.invoiceDate).slice(0, 7));

  if (!period) {
    throw new AccountingConfigurationError(
      "La fecha de la factura no permite determinar un período contable válido.",
      {
        invoiceDate: [
          "La fecha de la factura debe pertenecer a un período YYYY-MM válido.",
        ],
      },
    );
  }

  await ensureAccountingPeriodExists(tx, period, employeeId);

  const idempotencyKey = `sales:confirm:${input.prefacturaId}`;
  const [existingEntry] = await tx
    .select({
      id: accountingEntries.id,
      entryNumber: accountingEntries.entryNumber,
    })
    .from(accountingEntries)
    .where(eq(accountingEntries.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingEntry?.id) return existingEntry;

  const lines = buildSalesAccountingLines(input);
  const accountCodes = Array.from(new Set(lines.map((line) => line.accountCode)));
  const accountsByCode = await resolveAccountsByCode(tx, accountCodes);

  const totalDebit = lines.reduce(
    (sum, line) => sum + toMoneyNumber(line.debit),
    0,
  );
  const totalCredit = lines.reduce(
    (sum, line) => sum + toMoneyNumber(line.credit),
    0,
  );

  if (Math.abs(totalDebit - totalCredit) > 0.001 || totalDebit <= 0) {
    throw new AccountingConfigurationError(
      "El asiento generado para la venta no está balanceado.",
      {
        accounting: [
          "Revisa la composición del asiento de reconocimiento de ventas.",
        ],
      },
    );
  }

  const entryNumber = await generateAccountingEntryNumber(tx, period);

  const [entry] = await tx
    .insert(accountingEntries)
    .values({
      entryNumber,
      period,
      entryDate: input.invoiceDate,
      status: "POSTED",
      sourceModule: "SALES",
      sourceType: "PREFACTURA_INVOICED",
      sourceId: input.prefacturaId,
      idempotencyKey,
      description: `Reconocimiento de venta ${input.prefacturaCode}`,
      externalReference: input.prefacturaCode,
      postedAt: new Date(),
      postedBy: employeeId,
      metadata: {
        prefacturaId: input.prefacturaId,
        clientId: input.clientId,
      },
      createdBy: employeeId,
    })
    .returning({
      id: accountingEntries.id,
      entryNumber: accountingEntries.entryNumber,
    });

  await tx.insert(accountingEntryLines).values(
    lines.map((line, index) => ({
      entryId: entry.id,
      accountId: accountsByCode.get(line.accountCode)?.id,
      thirdPartyType: line.thirdPartyType ?? null,
      thirdPartyId: line.thirdPartyId ?? null,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
      lineOrder: index + 1,
      metadata: line.metadata ?? null,
    })),
  );

  await tx.insert(accountingEntryHistory).values({
    entryId: entry.id,
    action: "POSTED_FROM_PREFACTURA_INVOICED",
    notes: `Asiento generado por confirmación SIIGO de ${input.prefacturaCode}.`,
    payload: { prefacturaId: input.prefacturaId },
    performedBy: employeeId,
  });

  return entry;
}

export async function getSalesPostingPayload(
  tx: any,
  prefacturaId: string,
  opts: { issuedAt?: Date | null } = {},
): Promise<SalesPostingInput | null> {
  const [pf] = await tx
    .select({
      id: prefacturas.id,
      prefacturaCode: prefacturas.prefacturaCode,
      clientId: prefacturas.clientId,
      subtotal: prefacturas.subtotal,
      ivaAmount: prefacturas.ivaAmount,
      total: prefacturas.total,
    })
    .from(prefacturas)
    .where(eq(prefacturas.id, prefacturaId))
    .limit(1);

  if (!pf?.id || !pf.clientId) return null;

  const invoiceDate = (opts.issuedAt ?? new Date()).toISOString().slice(0, 10);

  return {
    prefacturaId: String(pf.id),
    prefacturaCode: String(pf.prefacturaCode),
    clientId: String(pf.clientId),
    invoiceDate,
    subtotal: String(pf.subtotal ?? "0"),
    ivaAmount: String(pf.ivaAmount ?? "0"),
    total: String(pf.total ?? "0"),
  };
}

// ── Purchases / CxP accounting ────────────────────────────────────────────────

export type PurchaseReceiptPostingInput = {
  receiptId: string;
  receiptCode: string;
  supplierId: string;
  receiptDate: string; // YYYY-MM-DD
  /** Total value of goods received */
  totalValue: string | number;
};

/**
 * DR  Inventario MP (143505)       – goods received
 * CR  GRNI / mercanc. en tránsito (190590) – until supplier invoice arrives
 */
export async function postPurchaseReceiptEntry(
  tx: any,
  input: PurchaseReceiptPostingInput,
  employeeId: string | null,
) {
  const period = parseAccountingPeriod(String(input.receiptDate).slice(0, 7));

  if (!period) {
    throw new AccountingConfigurationError(
      "La fecha del recibo de compras no permite determinar un período contable válido.",
      { receiptDate: ["Fecha inválida para período contable."] },
    );
  }

  await ensureAccountingPeriodExists(tx, period, employeeId);

  const idempotencyKey = `purchase-receipt:confirm:${input.receiptId}`;
  const [existingEntry] = await tx
    .select({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber })
    .from(accountingEntries)
    .where(eq(accountingEntries.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingEntry?.id) return existingEntry;

  const amount = toMoneyNumber(input.totalValue);

  const lines: AccountingLineDraft[] = [
    {
      accountCode: ACCOUNTING_ACCOUNT_CODES.rawMaterials,
      debit: toMoneyString(amount),
      credit: "0.00",
      description: `Ingreso MP recibo ${input.receiptCode}`,
      thirdPartyType: "PROVEEDOR",
      thirdPartyId: input.supplierId,
      metadata: { receiptId: input.receiptId },
    },
    {
      accountCode: ACCOUNTING_ACCOUNT_CODES.grni,
      debit: "0.00",
      credit: toMoneyString(amount),
      description: `GRNI recibo ${input.receiptCode}`,
      thirdPartyType: "PROVEEDOR",
      thirdPartyId: input.supplierId,
      metadata: { receiptId: input.receiptId },
    },
  ];

  const accountCodes = Array.from(new Set(lines.map((l) => l.accountCode)));
  const accountsByCode = await resolveAccountsByCode(tx, accountCodes);
  const entryNumber = await generateAccountingEntryNumber(tx, period);

  const [entry] = await tx
    .insert(accountingEntries)
    .values({
      entryNumber,
      period,
      entryDate: input.receiptDate,
      status: "POSTED",
      sourceModule: "PURCHASING",
      sourceType: "PURCHASE_RECEIPT",
      sourceId: input.receiptId,
      idempotencyKey,
      description: `Recibo de compras ${input.receiptCode}`,
      externalReference: input.receiptCode,
      postedAt: new Date(),
      postedBy: employeeId,
      metadata: { receiptId: input.receiptId, supplierId: input.supplierId },
      createdBy: employeeId,
    })
    .returning({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber });

  await tx.insert(accountingEntryLines).values(
    lines.map((line, index) => ({
      entryId: entry.id,
      accountId: accountsByCode.get(line.accountCode)?.id,
      thirdPartyType: line.thirdPartyType ?? null,
      thirdPartyId: line.thirdPartyId ?? null,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
      lineOrder: index + 1,
      metadata: line.metadata ?? null,
    })),
  );

  await tx.insert(accountingEntryHistory).values({
    entryId: entry.id,
    action: "POSTED_FROM_PURCHASE_RECEIPT",
    notes: `Asiento generado para recibo de compras ${input.receiptCode}.`,
    payload: { receiptId: input.receiptId },
    performedBy: employeeId,
  });

  return entry;
}

export type SupplierInvoicePostingInput = {
  invoiceId: string;
  invoiceCode: string;
  supplierId: string;
  receiptId: string | null;
  invoiceDate: string; // YYYY-MM-DD
  subtotal: string | number;
  ivaAmount: string | number;
  withholdingTax: string | number;
  withholdingIva: string | number;
  withholdingIca: string | number;
  total: string | number;
};

/**
 * Matches GRNI against real supplier invoice (AP recognition).
 * DR  GRNI (190590)              – clear goods-in-transit
 * CR  CxP Proveedor (220505)    – net payable
 * CR  Retefuente / ReteIVA / ReteICA (withholding liability accounts)
 */
export async function postSupplierInvoiceEntry(
  tx: any,
  input: SupplierInvoicePostingInput,
  employeeId: string | null,
) {
  const period = parseAccountingPeriod(String(input.invoiceDate).slice(0, 7));

  if (!period) {
    throw new AccountingConfigurationError(
      "La fecha de la factura de proveedor no permite determinar un período contable válido.",
      { invoiceDate: ["Fecha inválida para período contable."] },
    );
  }

  await ensureAccountingPeriodExists(tx, period, employeeId);

  const idempotencyKey = `supplier-invoice:post:${input.invoiceId}`;
  const [existingEntry] = await tx
    .select({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber })
    .from(accountingEntries)
    .where(eq(accountingEntries.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingEntry?.id) return existingEntry;

  const subtotal = toMoneyNumber(input.subtotal);
  const netPayable = toMoneyNumber(input.total);
  const rete = toMoneyNumber(input.withholdingTax);
  const reteIva = toMoneyNumber(input.withholdingIva);
  const reteIca = toMoneyNumber(input.withholdingIca);

  const lines: AccountingLineDraft[] = [
    {
      accountCode: ACCOUNTING_ACCOUNT_CODES.grni,
      debit: toMoneyString(subtotal),
      credit: "0.00",
      description: `Liquidación GRNI factura ${input.invoiceCode}`,
      thirdPartyType: "PROVEEDOR",
      thirdPartyId: input.supplierId,
      metadata: { invoiceId: input.invoiceId, receiptId: input.receiptId },
    },
    {
      accountCode: ACCOUNTING_ACCOUNT_CODES.accountsPayable,
      debit: "0.00",
      credit: toMoneyString(netPayable),
      description: `CxP factura proveedor ${input.invoiceCode}`,
      thirdPartyType: "PROVEEDOR",
      thirdPartyId: input.supplierId,
      metadata: { invoiceId: input.invoiceId },
    },
  ];

  // Withholdings reduce the payable and generate liability
  if (rete > 0) {
    lines[1].credit = toMoneyString(netPayable - rete);
    lines.push({
      accountCode: "236540", // Retefuente (PUC standard)
      debit: "0.00",
      credit: toMoneyString(rete),
      description: `Retefuente factura ${input.invoiceCode}`,
      thirdPartyType: "PROVEEDOR",
      thirdPartyId: input.supplierId,
      metadata: { invoiceId: input.invoiceId },
    });
  }
  if (reteIva > 0) {
    lines.push({
      accountCode: "236701", // ReteIVA
      debit: "0.00",
      credit: toMoneyString(reteIva),
      description: `ReteIVA factura ${input.invoiceCode}`,
      thirdPartyType: "PROVEEDOR",
      thirdPartyId: input.supplierId,
      metadata: { invoiceId: input.invoiceId },
    });
  }
  if (reteIca > 0) {
    lines.push({
      accountCode: "236801", // ReteICA
      debit: "0.00",
      credit: toMoneyString(reteIca),
      description: `ReteICA factura ${input.invoiceCode}`,
      thirdPartyType: "PROVEEDOR",
      thirdPartyId: input.supplierId,
      metadata: { invoiceId: input.invoiceId },
    });
  }

  const accountCodes = Array.from(new Set(lines.map((l) => l.accountCode)));
  const accountsByCode = await resolveAccountsByCode(tx, accountCodes);
  const entryNumber = await generateAccountingEntryNumber(tx, period);

  const [entry] = await tx
    .insert(accountingEntries)
    .values({
      entryNumber,
      period,
      entryDate: input.invoiceDate,
      status: "POSTED",
      sourceModule: "PURCHASING",
      sourceType: "SUPPLIER_INVOICE",
      sourceId: input.invoiceId,
      idempotencyKey,
      description: `Factura de proveedor ${input.invoiceCode}`,
      externalReference: input.invoiceCode,
      postedAt: new Date(),
      postedBy: employeeId,
      metadata: { invoiceId: input.invoiceId, supplierId: input.supplierId },
      createdBy: employeeId,
    })
    .returning({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber });

  await tx.insert(accountingEntryLines).values(
    lines.map((line, index) => ({
      entryId: entry.id,
      accountId: accountsByCode.get(line.accountCode)?.id,
      thirdPartyType: line.thirdPartyType ?? null,
      thirdPartyId: line.thirdPartyId ?? null,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
      lineOrder: index + 1,
      metadata: line.metadata ?? null,
    })),
  );

  await tx.insert(accountingEntryHistory).values({
    entryId: entry.id,
    action: "POSTED_FROM_SUPPLIER_INVOICE",
    notes: `Asiento generado para factura de proveedor ${input.invoiceCode}.`,
    payload: { invoiceId: input.invoiceId },
    performedBy: employeeId,
  });

  return entry;
}

export type SupplierPaymentPostingInput = {
  paymentId: string;
  paymentCode: string;
  supplierId: string;
  invoiceId: string;
  invoiceCode: string;
  paymentDate: string; // YYYY-MM-DD
  amount: string | number;
  paymentMethod: string; // EFECTIVO | TRANSFERENCIA
};

/**
 * DR  CxP Proveedor (220505)     – reduce payable
 * CR  Caja/Banco (110505 | 111005) – cash out
 */
export async function postSupplierPaymentEntry(
  tx: any,
  input: SupplierPaymentPostingInput,
  employeeId: string | null,
) {
  const period = parseAccountingPeriod(String(input.paymentDate).slice(0, 7));

  if (!period) {
    throw new AccountingConfigurationError(
      "La fecha del pago al proveedor no permite determinar un período contable válido.",
      { paymentDate: ["Fecha inválida para período contable."] },
    );
  }

  await ensureAccountingPeriodExists(tx, period, employeeId);

  const idempotencyKey = `supplier-payment:complete:${input.paymentId}`;
  const [existingEntry] = await tx
    .select({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber })
    .from(accountingEntries)
    .where(eq(accountingEntries.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingEntry?.id) return existingEntry;

  const amount = toMoneyNumber(input.amount);
  const treasuryCode = getReceiptTreasuryAccountCode(input.paymentMethod);

  const lines: AccountingLineDraft[] = [
    {
      accountCode: ACCOUNTING_ACCOUNT_CODES.accountsPayable,
      debit: toMoneyString(amount),
      credit: "0.00",
      description: `Pago proveedor ${input.paymentCode}`,
      thirdPartyType: "PROVEEDOR",
      thirdPartyId: input.supplierId,
      metadata: { paymentId: input.paymentId, invoiceId: input.invoiceId },
    },
    {
      accountCode: treasuryCode,
      debit: "0.00",
      credit: toMoneyString(amount),
      description: `Egreso pago ${input.paymentCode}`,
      thirdPartyType: "PROVEEDOR",
      thirdPartyId: input.supplierId,
      metadata: { paymentId: input.paymentId },
    },
  ];

  const accountCodes = Array.from(new Set(lines.map((l) => l.accountCode)));
  const accountsByCode = await resolveAccountsByCode(tx, accountCodes);
  const entryNumber = await generateAccountingEntryNumber(tx, period);

  const [entry] = await tx
    .insert(accountingEntries)
    .values({
      entryNumber,
      period,
      entryDate: input.paymentDate,
      status: "POSTED",
      sourceModule: "PURCHASING",
      sourceType: "SUPPLIER_PAYMENT",
      sourceId: input.paymentId,
      idempotencyKey,
      description: `Pago a proveedor ${input.paymentCode}`,
      externalReference: input.paymentCode,
      postedAt: new Date(),
      postedBy: employeeId,
      metadata: { paymentId: input.paymentId, supplierId: input.supplierId, invoiceCode: input.invoiceCode },
      createdBy: employeeId,
    })
    .returning({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber });

  await tx.insert(accountingEntryLines).values(
    lines.map((line, index) => ({
      entryId: entry.id,
      accountId: accountsByCode.get(line.accountCode)?.id,
      thirdPartyType: line.thirdPartyType ?? null,
      thirdPartyId: line.thirdPartyId ?? null,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
      lineOrder: index + 1,
      metadata: line.metadata ?? null,
    })),
  );

  await tx.insert(accountingEntryHistory).values({
    entryId: entry.id,
    action: "POSTED_FROM_SUPPLIER_PAYMENT",
    notes: `Asiento generado para pago a proveedor ${input.paymentCode}.`,
    payload: { paymentId: input.paymentId, invoiceId: input.invoiceId },
    performedBy: employeeId,
  });

  return entry;
}

export type LaborPaymentPostingInput = {
  requestId: string;
  requestCode: string;
  workerId: string;              // confectionist or packer employee ID
  paymentDate: string;           // YYYY-MM-DD
  amount: string | number;
  paymentMethod: string;
  laborType: "CONFECCION" | "EMPAQUE";
};

function getLaborAccountCode(laborType: "CONFECCION" | "EMPAQUE") {
  return laborType === "CONFECCION"
    ? ACCOUNTING_ACCOUNT_CODES.confectionistLabor
    : ACCOUNTING_ACCOUNT_CODES.packerLabor;
}

/**
 * Shared posting for confectionist and packer payments.
 * DR  Gasto MO confección/empaque (623505 | 623510) – labor cost
 * CR  Caja/Banco – cash out
 */
async function postLaborPaymentEntry(
  tx: any,
  input: LaborPaymentPostingInput,
  employeeId: string | null,
  sourceType: string,
) {
  const period = parseAccountingPeriod(String(input.paymentDate).slice(0, 7));

  if (!period) {
    throw new AccountingConfigurationError(
      "La fecha del pago de mano de obra no permite determinar un período contable válido.",
      { paymentDate: ["Fecha inválida para período contable."] },
    );
  }

  await ensureAccountingPeriodExists(tx, period, employeeId);

  const idempotencyKey = `labor-payment:${input.laborType.toLowerCase()}:${input.requestId}`;
  const [existingEntry] = await tx
    .select({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber })
    .from(accountingEntries)
    .where(eq(accountingEntries.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingEntry?.id) return existingEntry;

  const amount = toMoneyNumber(input.amount);
  const thirdPartyType = input.laborType === "CONFECCION" ? ("CONFECCIONISTA" as const) : ("EMPAQUE" as const);

  const lines: AccountingLineDraft[] = [
    {
      accountCode: getLaborAccountCode(input.laborType),
      debit: toMoneyString(amount),
      credit: "0.00",
      description: `MO ${input.laborType.toLowerCase()} ${input.requestCode}`,
      thirdPartyType,
      thirdPartyId: input.workerId,
      metadata: { requestId: input.requestId },
    },
    {
      accountCode: getReceiptTreasuryAccountCode(input.paymentMethod),
      debit: "0.00",
      credit: toMoneyString(amount),
      description: `Pago MO ${input.requestCode}`,
      thirdPartyType,
      thirdPartyId: input.workerId,
      metadata: { requestId: input.requestId },
    },
  ];

  const accountCodes = Array.from(new Set(lines.map((l) => l.accountCode)));
  const accountsByCode = await resolveAccountsByCode(tx, accountCodes);
  const entryNumber = await generateAccountingEntryNumber(tx, period);

  const [entry] = await tx
    .insert(accountingEntries)
    .values({
      entryNumber,
      period,
      entryDate: input.paymentDate,
      status: "POSTED",
      sourceModule: "PRODUCTION",
      sourceType,
      sourceId: input.requestId,
      idempotencyKey,
      description: `Pago MO ${input.laborType} ${input.requestCode}`,
      externalReference: input.requestCode,
      postedAt: new Date(),
      postedBy: employeeId,
      metadata: { requestId: input.requestId, workerId: input.workerId },
      createdBy: employeeId,
    })
    .returning({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber });

  await tx.insert(accountingEntryLines).values(
    lines.map((line, index) => ({
      entryId: entry.id,
      accountId: accountsByCode.get(line.accountCode)?.id,
      thirdPartyType: line.thirdPartyType ?? null,
      thirdPartyId: line.thirdPartyId ?? null,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
      lineOrder: index + 1,
      metadata: line.metadata ?? null,
    })),
  );

  await tx.insert(accountingEntryHistory).values({
    entryId: entry.id,
    action: `POSTED_FROM_${sourceType}`,
    notes: `Asiento generado para pago de MO ${input.requestCode}.`,
    payload: { requestId: input.requestId },
    performedBy: employeeId,
  });

  return entry;
}

export async function postConfectionistPaymentEntry(
  tx: any,
  input: LaborPaymentPostingInput,
  employeeId: string | null,
) {
  return postLaborPaymentEntry(tx, { ...input, laborType: "CONFECCION" }, employeeId, "CONFECTIONIST_PAYMENT");
}

export async function postPackerPaymentEntry(
  tx: any,
  input: LaborPaymentPostingInput,
  employeeId: string | null,
) {
  return postLaborPaymentEntry(tx, { ...input, laborType: "EMPAQUE" }, employeeId, "PACKER_PAYMENT");
}