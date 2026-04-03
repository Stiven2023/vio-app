import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { accountingPeriods } from "@/src/db/schema";
import { jsonError } from "@/src/utils/api-error";

export const accountingPeriodSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El período debe usar formato YYYY-MM.");

export function parseAccountingPeriod(value: unknown) {
  const result = accountingPeriodSchema.safeParse(value);

  return result.success ? result.data : null;
}

export function getAccountingPeriodFromDate(value: Date | string) {
  const dateValue = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(dateValue.getTime())) return null;

  const year = dateValue.getUTCFullYear();
  const month = String(dateValue.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export async function isAccountingPeriodClosed(
  db: Pick<any, "select">,
  period: string,
) {
  const normalizedPeriod = parseAccountingPeriod(period);

  if (!normalizedPeriod) return false;

  const [row] = await db
    .select({ id: accountingPeriods.id })
    .from(accountingPeriods)
    .where(
      and(
        eq(accountingPeriods.period, normalizedPeriod),
        eq(accountingPeriods.status, "CLOSED"),
      ),
    )
    .limit(1);

  return Boolean(row?.id);
}

export async function assertAccountingPeriodOpen(
  db: Pick<any, "select">,
  period: string,
  opts?: {
    fieldName?: string;
    message?: string;
    code?: string;
  },
) {
  const normalizedPeriod = parseAccountingPeriod(period);

  if (!normalizedPeriod) {
    return jsonError(400, opts?.code ?? "VALIDATION_ERROR", "Datos inválidos.", {
      [opts?.fieldName ?? "period"]: [
        "El período debe usar formato YYYY-MM.",
      ],
    });
  }

  const closed = await isAccountingPeriodClosed(db, normalizedPeriod);

  if (!closed) return null;

  return jsonError(
    409,
    opts?.code ?? "ACCOUNTING_PERIOD_CLOSED",
    opts?.message ??
      "El período contable está cerrado. Registra un ajuste formal o usa un período abierto.",
    {
      [opts?.fieldName ?? "period"]: [
        "El período contable está cerrado.",
      ],
    },
  );
}