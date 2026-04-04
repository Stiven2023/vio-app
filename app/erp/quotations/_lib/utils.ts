import type { TaxZone, UiLocale } from "./types";

export const TAX_ZONE_DEFAULT_RATES: Record<
  TaxZone,
  {
    withholdingTaxRate: number;
    withholdingIcaRate: number;
    withholdingIvaRate: number;
  }
> = {
  CONTINENTAL: {
    withholdingTaxRate: 2.5,
    withholdingIcaRate: 0.966,
    withholdingIvaRate: 15,
  },
  FREE_ZONE: {
    withholdingTaxRate: 0,
    withholdingIcaRate: 0,
    withholdingIvaRate: 0,
  },
  SAN_ANDRES: {
    withholdingTaxRate: 0,
    withholdingIcaRate: 0.5,
    withholdingIvaRate: 0,
  },
  SPECIAL_REGIME: {
    withholdingTaxRate: 1,
    withholdingIcaRate: 0.7,
    withholdingIvaRate: 0,
  },
};

export function resolveQuotationUiLocale(): UiLocale {
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
  const value = String(fromStorage || fromCookie || fromHtml || "en")
    .trim()
    .toLowerCase();

  return value.startsWith("es") ? "es" : "en";
}

export function getQuotationUiLocale(): UiLocale {
  return "en";
}

export function normalizeTaxZone(value: unknown): TaxZone {
  const raw = String(value ?? "CONTINENTAL")
    .trim()
    .toUpperCase();

  if (raw === "FREE_ZONE" || raw === "SAN_ANDRES" || raw === "SPECIAL_REGIME") {
    return raw;
  }

  return "CONTINENTAL";
}

export function safeRate(value: unknown, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) return fallback;

  return parsed;
}