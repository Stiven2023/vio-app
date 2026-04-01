import * as XLSX from "xlsx";

import {
  ACCOUNTS_RECEIVABLE_COPY,
  getAgingLabel,
  getCreditBackingLabel,
} from "./cartera.constants";
import type {
  AccountsReceivableData,
  AccountsReceivableLocale,
  AccountsReceivableRow,
  AgingBucket,
  CreditBackingType,
} from "./types";

export function getAccountsReceivableUiLocale(): AccountsReceivableLocale {
  const fromStorage =
    typeof window !== "undefined"
      ? window.localStorage.getItem("preferredLanguage")
      : null;
  const fromCookie =
    typeof document !== "undefined"
      ? (document.cookie
          .split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith("NEXT_LOCALE="))
          ?.split("=")[1] ?? null)
      : null;
  const fromHtml =
    typeof document !== "undefined" ? document.documentElement.lang : null;
  const normalized = String(fromStorage || fromCookie || fromHtml || "es")
    .trim()
    .toLowerCase();

  return normalized.startsWith("es") ? "es" : "en";
}

export function toNumber(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(
  locale: AccountsReceivableLocale,
  value: string | number | null | undefined,
): string {
  return new Intl.NumberFormat(locale === "es" ? "es-CO" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

export function formatDate(
  locale: AccountsReceivableLocale,
  value: string | null | undefined,
): string {
  if (!value) return "-";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(locale === "es" ? "es-CO" : "en-US");
}

export function getAgingBucketColor(
  bucket: AgingBucket | null | undefined,
): "success" | "primary" | "warning" | "secondary" | "danger" | "default" {
  switch (bucket) {
    case "CURRENT":
      return "success";
    case "1_30":
      return "primary";
    case "31_60":
      return "warning";
    case "61_90":
      return "secondary";
    case "90_PLUS":
      return "danger";
    default:
      return "default";
  }
}

export function getAgingBucketLabel(
  locale: AccountsReceivableLocale,
  bucket: AgingBucket | null | undefined,
): string {
  return bucket ? getAgingLabel(locale, bucket) : "-";
}

export function getCreditBackingDisplay(
  locale: AccountsReceivableLocale,
  type: CreditBackingType | null | undefined,
): string {
  return type ? getCreditBackingLabel(locale, type) : "-";
}

export function getDaysOverdueLabel(
  locale: AccountsReceivableLocale,
  daysOverdue: number | null,
): string {
  if (daysOverdue == null) return "-";

  const tableCopy = ACCOUNTS_RECEIVABLE_COPY[locale].creditTable;

  if (daysOverdue < 0) {
    return `${Math.abs(daysOverdue)} ${tableCopy.remainingDays}`;
  }

  return `${daysOverdue} ${tableCopy.overdueDays}`;
}

export function exportCreditToExcel(
  locale: AccountsReceivableLocale,
  rows: AccountsReceivableRow[],
): void {
  const copy = ACCOUNTS_RECEIVABLE_COPY[locale].export;
  const worksheet = XLSX.utils.aoa_to_sheet([
    [
      copy.headers.client,
      copy.headers.preinvoice,
      copy.headers.invoiceDate,
      copy.headers.dueDate,
      copy.headers.total,
      copy.headers.paid,
      copy.headers.balance,
      copy.headers.daysOverdue,
      copy.headers.aging,
      copy.headers.backing,
    ],
    ...rows.map((row) => [
      row.clientName ?? "",
      row.prefacturaCode,
      formatDate(locale, row.approvedAt),
      formatDate(locale, row.dueDate),
      toNumber(row.totalAmount).toFixed(2),
      toNumber(row.amountPaid).toFixed(2),
      toNumber(row.balanceDue).toFixed(2),
      row.daysOverdue ?? 0,
      getAgingBucketLabel(locale, row.agingBucket),
      getCreditBackingDisplay(locale, row.creditBackingType),
    ]),
  ]);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, copy.creditSheet);
  XLSX.writeFile(
    workbook,
    `${copy.creditFilePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

export function exportCashToExcel(
  locale: AccountsReceivableLocale,
  rows: AccountsReceivableRow[],
): void {
  const copy = ACCOUNTS_RECEIVABLE_COPY[locale].export;
  const worksheet = XLSX.utils.aoa_to_sheet([
    [
      copy.headers.client,
      copy.headers.preinvoice,
      copy.headers.invoiceDate,
      copy.headers.total,
      copy.headers.paid,
      copy.headers.balance,
    ],
    ...rows.map((row) => [
      row.clientName ?? "",
      row.prefacturaCode,
      formatDate(locale, row.approvedAt),
      toNumber(row.totalAmount).toFixed(2),
      toNumber(row.amountPaid).toFixed(2),
      toNumber(row.balanceDue).toFixed(2),
    ]),
  ]);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, copy.cashSheet);
  XLSX.writeFile(
    workbook,
    `${copy.cashFilePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

export function getTotalPages(data: AccountsReceivableData | null): number {
  return Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 15));
}