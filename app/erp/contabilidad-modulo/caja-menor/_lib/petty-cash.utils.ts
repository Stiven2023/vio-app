import type { PettyCashLocale, TransactionType } from "./types";

export function getPettyCashUiLocale(): PettyCashLocale {
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
  locale: PettyCashLocale,
  value: string | number | null | undefined,
): string {
  return new Intl.NumberFormat(locale === "es" ? "es-CO" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

export function getTransactionTypeColor(
  type: TransactionType,
): "danger" | "success" | "primary" | "warning" {
  if (type === "EXPENSE") return "danger";
  if (type === "REPLENISHMENT") return "success";
  if (type === "OPENING") return "primary";

  return "warning";
}

export function getSignedAmountPrefix(type: TransactionType): string {
  return type === "EXPENSE" ? "−" : "+";
}

export function getMovementCountLabel(
  locale: PettyCashLocale,
  total: number,
): string {
  const singular = locale === "es" ? "movimiento" : "transaction";
  const plural = locale === "es" ? "movimientos" : "transactions";

  return `${total} ${total === 1 ? singular : plural}`;
}