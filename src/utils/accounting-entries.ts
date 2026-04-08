import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  accountingAccounts,
  accountingEntries,
  accountingEntryHistory,
  accountingEntryLines,
  accountingPeriods,
  cashReceiptApplications,
  cashReceipts,
  clients,
  orderPayments,
  orders,
  prefacturas,
} from "@/src/db/schema";
import { parseAccountingPeriod } from "@/src/utils/accounting-period";
import { isConfirmedPaymentStatus } from "@/src/utils/payment-status";

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
  // Petty cash / caja menor
  pettyCash: "110510",         // Caja menor
  generalExpenses: "511595",   // Gastos generales administrativos
  // Bank reconciliation adjustments
  miscIncome: "470595",        // Otros ingresos no operacionales
  financialDiscount: "530590", // Gastos financieros / descuento factoring
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

type OrderPaymentPostingInput = {
  paymentId: string;
  orderId: string;
  orderCode: string;
  clientId: string;
  paymentDate: string;
  paymentMethod: string;
  amount: string | number;
  referenceCode?: string | null;
  appliedToReceivable?: string | number | null;
  advanceAmount?: string | number | null;
  paymentKind?: "ABONO" | "ANTICIPO" | "MIXTO";
};

type OrderPaymentBreakdownInput = {
  amount: string | number;
  orderTotal: string | number;
  confirmedBeforePayment: string | number;
};

export function computeOrderPaymentBreakdown(input: OrderPaymentBreakdownInput) {
  const amount = Math.max(0, toMoneyNumber(input.amount));
  const orderTotal = Math.max(0, toMoneyNumber(input.orderTotal));
  const confirmedBeforePayment = Math.max(
    0,
    toMoneyNumber(input.confirmedBeforePayment),
  );
  const outstanding = Math.max(0, orderTotal - confirmedBeforePayment);
  const appliedToReceivable = Math.min(amount, outstanding);
  const advanceAmount = Math.max(0, amount - appliedToReceivable);

  let paymentKind: "ABONO" | "ANTICIPO" | "MIXTO" = "ANTICIPO";

  if (appliedToReceivable > 0.001 && advanceAmount > 0.001) {
    paymentKind = "MIXTO";
  } else if (appliedToReceivable > 0.001) {
    paymentKind = "ABONO";
  }

  return {
    appliedToReceivable: toMoneyString(appliedToReceivable),
    advanceAmount: toMoneyString(advanceAmount),
    paymentKind,
  };
}

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

export function buildOrderPaymentAccountingLines(
  input: OrderPaymentPostingInput,
): AccountingLineDraft[] {
  const amount = toMoneyNumber(input.amount);
  const providedApplied = Math.max(0, toMoneyNumber(input.appliedToReceivable));
  const providedAdvance = Math.max(0, toMoneyNumber(input.advanceAmount));
  const hasExplicitBreakdown =
    input.appliedToReceivable !== undefined || input.advanceAmount !== undefined;
  const receivableCredit = hasExplicitBreakdown
    ? Math.min(amount, providedApplied)
    : 0;
  const advanceCredit = hasExplicitBreakdown
    ? Math.max(0, amount - receivableCredit)
    : amount;
  const resolvedKind =
    input.paymentKind ??
    (receivableCredit > 0.001 && advanceCredit > 0.001
      ? "MIXTO"
      : receivableCredit > 0.001
        ? "ABONO"
        : "ANTICIPO");

  const lines: AccountingLineDraft[] = [
    {
      accountCode: getReceiptTreasuryAccountCode(input.paymentMethod),
      debit: toMoneyString(amount),
      credit: "0.00",
      description: `Pago pedido ${input.orderCode}`,
      thirdPartyType: "CLIENTE",
      thirdPartyId: input.clientId,
      metadata: {
        orderId: input.orderId,
        paymentId: input.paymentId,
        referenceCode: input.referenceCode ?? null,
        paymentKind: resolvedKind,
      },
    },
  ];

  if (receivableCredit > 0.001) {
    lines.push({
      accountCode: ACCOUNTING_ACCOUNT_CODES.accountsReceivable,
      debit: "0.00",
      credit: toMoneyString(receivableCredit),
      description: `Abono cliente pedido ${input.orderCode}`,
      thirdPartyType: "CLIENTE",
      thirdPartyId: input.clientId,
      metadata: {
        orderId: input.orderId,
        paymentId: input.paymentId,
        referenceCode: input.referenceCode ?? null,
        paymentKind: resolvedKind,
      },
    });
  }

  if (advanceCredit > 0.001) {
    lines.push({
      accountCode: ACCOUNTING_ACCOUNT_CODES.customerAdvances,
      debit: "0.00",
      credit: toMoneyString(advanceCredit),
      description: `Anticipo cliente pedido ${input.orderCode}`,
      thirdPartyType: "CLIENTE",
      thirdPartyId: input.clientId,
      metadata: {
        orderId: input.orderId,
        paymentId: input.paymentId,
        referenceCode: input.referenceCode ?? null,
        paymentKind: resolvedKind,
      },
    });
  }

  return lines;
}

export async function postOrderPaymentAccountingEntry(
  tx: any,
  input: OrderPaymentPostingInput,
  employeeId: string | null,
) {
  const period = parseAccountingPeriod(String(input.paymentDate).slice(0, 7));

  if (!period) {
    throw new AccountingConfigurationError(
      "La fecha del pago no permite determinar un período contable válido.",
      {
        paymentDate: ["La fecha del pago debe pertenecer a un período YYYY-MM válido."],
      },
    );
  }

  await ensureAccountingPeriodExists(tx, period, employeeId);

  const idempotencyKey = `order-payment:confirm:${input.paymentId}`;
  const [existingEntry] = await tx
    .select({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber })
    .from(accountingEntries)
    .where(eq(accountingEntries.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingEntry?.id) return existingEntry;

  const lines = buildOrderPaymentAccountingLines(input);
  const accountCodes = Array.from(new Set(lines.map((line) => line.accountCode)));
  const accountsByCode = await resolveAccountsByCode(tx, accountCodes);

  const totalDebit = lines.reduce((sum, line) => sum + toMoneyNumber(line.debit), 0);
  const totalCredit = lines.reduce((sum, line) => sum + toMoneyNumber(line.credit), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001 || totalDebit <= 0) {
    throw new AccountingConfigurationError(
      "El asiento generado para el pago del pedido no está balanceado.",
      {
        accounting: ["Revisa la composición del asiento del pago del pedido."],
      },
    );
  }

  const entryNumber = await generateAccountingEntryNumber(tx, period);

  const [entry] = await tx
    .insert(accountingEntries)
    .values({
      entryNumber,
      period,
      entryDate: input.paymentDate,
      status: "POSTED",
      sourceModule: "TREASURY",
      sourceType: "ORDER_PAYMENT",
      sourceId: input.paymentId,
      idempotencyKey,
      description: `Pago pedido ${input.orderCode}`,
      externalReference: input.referenceCode ?? input.orderCode,
      postedAt: new Date(),
      postedBy: employeeId,
      metadata: {
        paymentId: input.paymentId,
        orderId: input.orderId,
        orderCode: input.orderCode,
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
    action: "POSTED_FROM_ORDER_PAYMENT",
    notes: `Asiento generado automáticamente para pago ${input.referenceCode ?? input.paymentId}.`,
    payload: {
      paymentId: input.paymentId,
      orderId: input.orderId,
    },
    performedBy: employeeId,
  });

  return entry;
}

export async function reverseOrderPaymentAccountingEntry(
  tx: any,
  args: {
    paymentId: string;
    paymentDate: string;
    referenceCode?: string | null;
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
    .where(eq(accountingEntries.idempotencyKey, `order-payment:confirm:${args.paymentId}`))
    .limit(1);

  if (!originalEntry?.id || String(originalEntry.status) === "REVERSED") {
    return null;
  }

  const reversalIdempotencyKey = `order-payment:void:${args.paymentId}`;
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
      entryDate: args.paymentDate,
      status: "POSTED",
      sourceModule: "TREASURY",
      sourceType: "ORDER_PAYMENT_VOID",
      sourceId: args.paymentId,
      idempotencyKey: reversalIdempotencyKey,
      description: `Reversión pago pedido ${args.referenceCode ?? args.paymentId}`,
      externalReference: args.referenceCode ?? args.paymentId,
      postedAt: new Date(),
      postedBy: args.employeeId,
      reversalOfId: originalEntry.id,
      metadata: {
        paymentId: args.paymentId,
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
      action: "REVERSED_FROM_ORDER_PAYMENT_VOID",
      notes: `Asiento revertido por anulación del pago ${args.referenceCode ?? args.paymentId}.`,
      payload: { paymentId: args.paymentId, reversalEntryId: reversalEntry.id },
      performedBy: args.employeeId,
    },
    {
      entryId: reversalEntry.id,
      action: "CREATED_AS_REVERSAL",
      notes: `Reversión automática del pago ${args.referenceCode ?? args.paymentId}.`,
      payload: { paymentId: args.paymentId, originalEntryId: originalEntry.id },
      performedBy: args.employeeId,
    },
  ]);

  return reversalEntry;
}

export async function getOrderPaymentPostingPayload(tx: any, paymentId: string) {
  const [payment] = await tx
    .select({
      id: orderPayments.id,
      orderId: orderPayments.orderId,
      orderCode: orders.orderCode,
      clientId: orders.clientId,
      orderTotal: orders.total,
      method: orderPayments.method,
      status: orderPayments.status,
      amount: orderPayments.amount,
      referenceCode: orderPayments.referenceCode,
      createdAt: orderPayments.createdAt,
    })
    .from(orderPayments)
    .innerJoin(orders, eq(orderPayments.orderId, orders.id))
    .innerJoin(clients, eq(orders.clientId, clients.id))
    .where(eq(orderPayments.id, paymentId))
    .limit(1);

  if (!payment?.id || !payment.orderId || !payment.clientId) return null;

  const siblingPayments: Array<{
    id: string;
    amount: string | number | null;
    status: string | null;
  }> = await tx
    .select({
      id: orderPayments.id,
      amount: orderPayments.amount,
      status: orderPayments.status,
    })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, payment.orderId));

  const confirmedBeforePayment = siblingPayments.reduce((sum, row) => {
    const samePayment = String(row.id) === String(payment.id);

    if (samePayment || !isConfirmedPaymentStatus(row.status)) return sum;

    return sum + toMoneyNumber(row.amount);
  }, 0);

  const breakdown = computeOrderPaymentBreakdown({
    amount: String(payment.amount ?? "0"),
    orderTotal: String(payment.orderTotal ?? "0"),
    confirmedBeforePayment,
  });

  const paymentDate = new Date(String(payment.createdAt ?? new Date().toISOString()))
    .toISOString()
    .slice(0, 10);

  return {
    paymentId: String(payment.id),
    orderId: String(payment.orderId),
    orderCode: String(payment.orderCode ?? ""),
    clientId: String(payment.clientId),
    paymentDate,
    paymentMethod: String(payment.method ?? "EFECTIVO"),
    amount: String(payment.amount ?? "0"),
    referenceCode: payment.referenceCode ? String(payment.referenceCode) : null,
    appliedToReceivable: breakdown.appliedToReceivable,
    advanceAmount: breakdown.advanceAmount,
    paymentKind: breakdown.paymentKind,
  } satisfies OrderPaymentPostingInput;
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

export type HcmPreAsientoPostingInput = {
  preAsientoId: string;
  period: string;
  entryDate: string;
  employeeId: string;
  accountDebitCode: string;
  accountCreditCode: string;
  amount: string | number;
  concept: string;
};

export async function postHcmPreAsientoEntry(
  tx: any,
  input: HcmPreAsientoPostingInput,
  employeeId: string | null,
) {
  const period = parseAccountingPeriod(input.period);

  if (!period) {
    throw new AccountingConfigurationError(
      "El período del pre-asiento no es válido para contabilidad.",
      {
        period: ["El período debe usar formato YYYY-MM."],
      },
    );
  }

  await ensureAccountingPeriodExists(tx, period, employeeId);

  const idempotencyKey = `hcm-pre-asiento:post:${input.preAsientoId}`;
  const [existingEntry] = await tx
    .select({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber })
    .from(accountingEntries)
    .where(eq(accountingEntries.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingEntry?.id) return existingEntry;

  const amount = toMoneyNumber(input.amount);

  if (amount <= 0) {
    throw new AccountingConfigurationError(
      "El valor del pre-asiento debe ser mayor a cero.",
      {
        amount: ["El valor debe ser mayor a cero."],
      },
    );
  }

  const lines: AccountingLineDraft[] = [
    {
      accountCode: input.accountDebitCode,
      debit: toMoneyString(amount),
      credit: "0.00",
      description: input.concept,
      thirdPartyType: "EMPLEADO",
      thirdPartyId: input.employeeId,
      metadata: { preAsientoId: input.preAsientoId },
    },
    {
      accountCode: input.accountCreditCode,
      debit: "0.00",
      credit: toMoneyString(amount),
      description: input.concept,
      thirdPartyType: "EMPLEADO",
      thirdPartyId: input.employeeId,
      metadata: { preAsientoId: input.preAsientoId },
    },
  ];

  const accountCodes = Array.from(new Set(lines.map((line) => line.accountCode)));
  const accountsByCode = await resolveAccountsByCode(tx, accountCodes);
  const entryNumber = await generateAccountingEntryNumber(tx, period);

  const [entry] = await tx
    .insert(accountingEntries)
    .values({
      entryNumber,
      period,
      entryDate: input.entryDate,
      status: "POSTED",
      sourceModule: "PAYROLL",
      sourceType: "HCM_PRE_ASIENTO",
      sourceId: input.preAsientoId,
      idempotencyKey,
      description: input.concept,
      totalDebit: toMoneyString(amount),
      totalCredit: toMoneyString(amount),
      postedAt: new Date(),
      postedBy: employeeId,
      metadata: { preAsientoId: input.preAsientoId },
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
    action: "POSTED_FROM_HCM_PRE_ASIENTO",
    notes: `Asiento generado para pre-asiento HCM ${input.preAsientoId}.`,
    payload: { preAsientoId: input.preAsientoId },
    performedBy: employeeId,
  });

  return entry;
}

// ── Factoring (accounts receivable assignment) ────────────────────────────────

type FactoringCollectedInput = {
  factoringId: string;
  factoringCode: string;
  clientId: string;
  collectionDate: string; // YYYY-MM-DD
  invoiceValue: string | number;
  netAmountReceived: string | number;
};

/**
 * Generates accounting entry when factoring is marked COLLECTED:
 *   Debit  Banks (net received)
 *   Debit  Financial costs / factoring discount
 *   Credit Accounts receivable (original invoice value)
 */
export async function postFactoringCollectedEntry(
  tx: any,
  input: FactoringCollectedInput,
  employeeId: string | null,
) {
  const invoiceValue = toMoneyNumber(input.invoiceValue);
  const netReceived = toMoneyNumber(input.netAmountReceived);
  const discountCost = invoiceValue - netReceived;

  if (invoiceValue <= 0) {
    throw new AccountingConfigurationError(
      "El valor de la factura debe ser mayor a cero para generar el asiento de factoring.",
      { invoiceValue: ["El valor de la factura debe ser positivo."] },
    );
  }

  const period = parseAccountingPeriod(String(input.collectionDate).slice(0, 7));

  if (!period) {
    throw new AccountingConfigurationError(
      "La fecha de cobro no permite determinar un período contable válido.",
      { collectionDate: ["La fecha de cobro debe tener formato YYYY-MM-DD."] },
    );
  }

  await ensureAccountingPeriodExists(tx, period, employeeId);

  const idempotencyKey = `factoring:collected:${input.factoringId}`;
  const [existingEntry] = await tx
    .select({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber })
    .from(accountingEntries)
    .where(eq(accountingEntries.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingEntry?.id) return existingEntry;

  const lines: AccountingLineDraft[] = [
    {
      accountCode: ACCOUNTING_ACCOUNT_CODES.banks,
      debit: toMoneyString(netReceived),
      credit: "0.00",
      description: `Cobro factoring ${input.factoringCode}`,
      thirdPartyType: "CLIENTE",
      thirdPartyId: input.clientId,
      metadata: { factoringId: input.factoringId },
    },
    ...(discountCost > 0.001
      ? [
          {
            accountCode: "530590", // Gastos financieros — descuento de factoring (PUC Colombia)
            debit: toMoneyString(discountCost),
            credit: "0.00",
            description: `Descuento factoring ${input.factoringCode}`,
            thirdPartyType: "CLIENTE" as const,
            thirdPartyId: input.clientId,
            metadata: { factoringId: input.factoringId },
          },
        ]
      : []),
    {
      accountCode: ACCOUNTING_ACCOUNT_CODES.accountsReceivable,
      debit: "0.00",
      credit: toMoneyString(invoiceValue),
      description: `Cancelación cartera factoring ${input.factoringCode}`,
      thirdPartyType: "CLIENTE",
      thirdPartyId: input.clientId,
      metadata: { factoringId: input.factoringId },
    },
  ];

  const totalDebit = lines.reduce((sum, line) => sum + toMoneyNumber(line.debit), 0);
  const totalCredit = lines.reduce((sum, line) => sum + toMoneyNumber(line.credit), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new AccountingConfigurationError(
      "El asiento de factoring no está balanceado. Verifica los valores.",
      { accounting: ["Débitos y créditos del asiento no coinciden."] },
    );
  }

  const accountCodes = Array.from(new Set(lines.map((line) => line.accountCode)));
  const accountsByCode = await resolveAccountsByCode(tx, accountCodes);
  const entryNumber = await generateAccountingEntryNumber(tx, period);

  const [entry] = await tx
    .insert(accountingEntries)
    .values({
      entryNumber,
      period,
      entryDate: input.collectionDate,
      status: "POSTED",
      sourceModule: "TREASURY",
      sourceType: "FACTORING_COLLECTED",
      sourceId: input.factoringId,
      idempotencyKey,
      description: `Cobro factoring ${input.factoringCode}`,
      externalReference: input.factoringCode,
      postedAt: new Date(),
      postedBy: employeeId,
      totalDebit: toMoneyString(totalDebit),
      totalCredit: toMoneyString(totalCredit),
      metadata: { factoringId: input.factoringId, clientId: input.clientId },
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
    action: "POSTED_FROM_FACTORING_COLLECTED",
    notes: `Asiento generado para cobro de factoring ${input.factoringCode}.`,
    payload: { factoringId: input.factoringId },
    performedBy: employeeId,
  });

  return entry;
}

// ---------------------------------------------------------------------------
// CAJA MENOR — Transacciones con asiento automático
// ---------------------------------------------------------------------------

export type PettyCashTransactionPostingInput = {
  transactionId: string;
  transactionCode: string;
  fundId: string;
  transactionDate: string;
  /** "EXPENSE" | "REPLENISHMENT" | "ADJUSTMENT" */
  transactionType: string;
  amount: string | number;
  description: string;
};

/**
 * Genera el asiento contable para una transacción de caja menor.
 *
 * EXPENSE:       DR 511595 Gastos generales  / CR 110510 Caja menor
 * REPLENISHMENT: DR 110510 Caja menor        / CR 111005 Bancos
 * ADJUSTMENT(+): DR 110510 Caja menor        / CR 470595 Otros ingresos
 * ADJUSTMENT(-): DR 511595 Gastos generales  / CR 110510 Caja menor
 *
 * `tx` debe ser una transacción Drizzle activa.
 */
export async function postPettyCashTransactionEntry(
  tx: any,
  input: PettyCashTransactionPostingInput,
  employeeId: string | null,
) {
  const numAmount = Math.abs(parseFloat(String(input.amount)));

  if (!Number.isFinite(numAmount) || numAmount === 0) {
    throw new Error("postPettyCashTransactionEntry: amount must be non-zero.");
  }

  const parsedPeriod = parseAccountingPeriod(input.transactionDate);

  if (!parsedPeriod) {
    throw new AccountingConfigurationError(
      "La fecha de la transacción no permite determinar un período contable válido.",
      { transactionDate: ["La fecha debe tener formato YYYY-MM-DD."] },
    );
  }

  const period = parsedPeriod;

  const type = String(input.transactionType).toUpperCase();

  let debitCode: string;
  let creditCode: string;

  if (type === "EXPENSE") {
    debitCode = ACCOUNTING_ACCOUNT_CODES.generalExpenses;
    creditCode = ACCOUNTING_ACCOUNT_CODES.pettyCash;
  } else if (type === "REPLENISHMENT") {
    debitCode = ACCOUNTING_ACCOUNT_CODES.pettyCash;
    creditCode = ACCOUNTING_ACCOUNT_CODES.banks;
  } else if (type === "ADJUSTMENT") {
    const isPositive = parseFloat(String(input.amount)) >= 0;

    if (isPositive) {
      debitCode = ACCOUNTING_ACCOUNT_CODES.pettyCash;
      creditCode = ACCOUNTING_ACCOUNT_CODES.miscIncome;
    } else {
      debitCode = ACCOUNTING_ACCOUNT_CODES.generalExpenses;
      creditCode = ACCOUNTING_ACCOUNT_CODES.pettyCash;
    }
  } else {
    // OPENING or unknown: DR pettyCash / CR banks
    debitCode = ACCOUNTING_ACCOUNT_CODES.pettyCash;
    creditCode = ACCOUNTING_ACCOUNT_CODES.banks;
  }

  const idempotencyKey = `petty-cash:tx:${input.transactionId}`;

  const existing = await tx
    .select({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber })
    .from(accountingEntries)
    .where(eq(accountingEntries.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const accountsByCode = await resolveAccountsByCode(tx, [debitCode, creditCode]);

  await ensureAccountingPeriodExists(tx, period, employeeId);

  const entryNumber = await generateAccountingEntryNumber(tx, period);
  const moneyStr = toMoneyString(numAmount);

  const lines = [
    {
      accountCode: debitCode,
      description: `Caja menor ${type.toLowerCase()} - ${input.transactionCode}`,
      debit: moneyStr,
      credit: "0.00",
    },
    {
      accountCode: creditCode,
      description: `Caja menor ${type.toLowerCase()} - ${input.transactionCode}`,
      debit: "0.00",
      credit: moneyStr,
    },
  ];

  const [entry] = await tx
    .insert(accountingEntries)
    .values({
      entryNumber,
      voucherType: "CM",
      period,
      entryDate: input.transactionDate,
      status: "POSTED" as const,
      sourceModule: "TREASURY" as const,
      sourceType: "PETTY_CASH_TRANSACTION",
      sourceId: input.transactionId,
      idempotencyKey,
      description: input.description,
      externalReference: input.transactionCode,
      postedAt: new Date(),
      postedBy: employeeId,
      totalDebit: moneyStr,
      totalCredit: moneyStr,
      metadata: { fundId: input.fundId, transactionType: type },
      createdBy: employeeId,
    })
    .returning({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber });

  await tx.insert(accountingEntryLines).values(
    lines.map((line, index) => ({
      entryId: entry.id,
      accountId: accountsByCode.get(line.accountCode)?.id,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
      lineOrder: index + 1,
    })),
  );

  await tx.insert(accountingEntryHistory).values({
    entryId: entry.id,
    action: "POSTED_FROM_PETTY_CASH",
    notes: `Asiento generado para transacción de caja menor ${input.transactionCode}.`,
    payload: { transactionId: input.transactionId, transactionType: type },
    performedBy: employeeId,
  });

  return entry;
}

// ---------------------------------------------------------------------------
// CONCILIACIÓN BANCARIA — Asiento de cierre/ajuste
// ---------------------------------------------------------------------------

export type ConciliationAdjustmentInput = {
  reconciliationId: string;
  period: string;
  /** Diferencia = balancePerBank - balancePerBooks (puede ser negativa) */
  difference: string | number;
  closedAt: string;
  bankName?: string | null;
};

/**
 * Genera el asiento de ajuste al cerrar una conciliación bancaria con diferencia ≠ 0.
 *
 * difference > 0 (banco tiene más que libros):
 *   DR 111005 Bancos  / CR 470595 Otros ingresos
 *
 * difference < 0 (libros tienen más que banco):
 *   DR 511595 Gastos generales  / CR 111005 Bancos
 *
 * `tx` debe ser una transacción Drizzle activa.
 * Retorna `null` si la diferencia es cero (no hay ajuste necesario).
 */
export async function postConciliationAdjustmentEntry(
  tx: any,
  input: ConciliationAdjustmentInput,
  employeeId: string | null,
) {
  const diff = parseFloat(String(input.difference));

  if (!Number.isFinite(diff) || diff === 0) return null;

  const absDiff = Math.abs(diff);

  let debitCode: string;
  let creditCode: string;

  if (diff > 0) {
    // Banco tiene más → ajustar libros al alza
    debitCode = ACCOUNTING_ACCOUNT_CODES.banks;
    creditCode = ACCOUNTING_ACCOUNT_CODES.miscIncome;
  } else {
    // Libros tienen más → registrar gasto/ajuste contra banco
    debitCode = ACCOUNTING_ACCOUNT_CODES.generalExpenses;
    creditCode = ACCOUNTING_ACCOUNT_CODES.banks;
  }

  const idempotencyKey = `conciliation:adjustment:${input.reconciliationId}`;

  const existing = await tx
    .select({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber })
    .from(accountingEntries)
    .where(eq(accountingEntries.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing.length > 0) return existing[0];

  const accountsByCode = await resolveAccountsByCode(tx, [debitCode, creditCode]);

  await ensureAccountingPeriodExists(tx, input.period, employeeId);

  const entryNumber = await generateAccountingEntryNumber(tx, input.period);
  const moneyStr = toMoneyString(absDiff);
  const label = diff > 0 ? "Ajuste conciliación (favor banco)" : "Ajuste conciliación (favor libros)";

  const lines = [
    {
      accountCode: debitCode,
      description: label,
      debit: moneyStr,
      credit: "0.00",
    },
    {
      accountCode: creditCode,
      description: label,
      debit: "0.00",
      credit: moneyStr,
    },
  ];

  const [entry] = await tx
    .insert(accountingEntries)
    .values({
      entryNumber,
      voucherType: "BA",
      period: input.period,
      entryDate: input.closedAt.substring(0, 10),
      status: "POSTED" as const,
      sourceModule: "TREASURY" as const,
      sourceType: "BANK_RECONCILIATION_CLOSE",
      sourceId: input.reconciliationId,
      idempotencyKey,
      description: label,
      postedAt: new Date(),
      postedBy: employeeId,
      totalDebit: moneyStr,
      totalCredit: moneyStr,
      metadata: { reconciliationId: input.reconciliationId, difference: diff },
      createdBy: employeeId,
    })
    .returning({ id: accountingEntries.id, entryNumber: accountingEntries.entryNumber });

  await tx.insert(accountingEntryLines).values(
    lines.map((line, index) => ({
      entryId: entry.id,
      accountId: accountsByCode.get(line.accountCode)?.id,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
      lineOrder: index + 1,
    })),
  );

  await tx.insert(accountingEntryHistory).values({
    entryId: entry.id,
    action: "POSTED_FROM_BANK_RECONCILIATION",
    notes: `Asiento de ajuste para conciliación bancaria ${input.reconciliationId}. Diferencia: ${diff}.`,
    payload: { reconciliationId: input.reconciliationId, difference: diff },
    performedBy: employeeId,
  });

  return entry;
}