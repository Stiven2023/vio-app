import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { exchangeRates } from "@/src/db/schema";

const DEFAULT_FLOOR_RATE = 3600;
const PROVIDER_NAME = "datos.gov.co (TRM Colombia)";
const PROVIDER_URL =
  "https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde DESC";

type ExchangeRateUpdate = {
  provider: string;
  sourceRate: number;
  floorRate: number;
  effectiveRate: number;
  adjustmentApplied: number;
  sourceDate: string | null;
  createdAt?: string | null;
};

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const input = String(value ?? "").trim();
  if (!input) return null;

  const cleaned = input.replace(/[^0-9,.-]/g, "");
  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  const lastSepIndex = Math.max(lastDot, lastComma);

  if (lastSepIndex === -1) {
    const digitsOnly = cleaned.replace(/[^0-9-]/g, "");
    const parsed = Number(digitsOnly);

    return Number.isFinite(parsed) ? parsed : null;
  }

  const digitsAfter = cleaned.length - lastSepIndex - 1;
  const digitsOnly = cleaned.replace(/[^0-9-]/g, "");

  if (digitsAfter === 0 || digitsAfter === 3) {
    const parsed = Number(digitsOnly);

    return Number.isFinite(parsed) ? parsed : null;
  }

  const integerPart = digitsOnly.slice(0, -digitsAfter) || "0";
  const decimalPart = digitsOnly.slice(-digitsAfter);
  const normalized = `${integerPart}.${decimalPart}`;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function applyRateFloor(sourceRate: number, floorRate = DEFAULT_FLOOR_RATE) {
  const effectiveRate = Math.max(sourceRate, floorRate);
  const adjustmentApplied = Math.max(0, effectiveRate - sourceRate);

  return {
    floorRate,
    effectiveRate,
    adjustmentApplied,
  };
}

async function fetchOfficialUsdCopRate() {
  const response = await fetch(PROVIDER_URL, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo consultar TRM oficial: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as Array<Record<string, unknown>>;
  const row = Array.isArray(payload) ? payload[0] : null;

  if (!row) {
    throw new Error("La API oficial no devolvió datos de TRM");
  }

  const sourceRate =
    toNumber(row.valor) ??
    toNumber(row.trm) ??
    toNumber(row.valorcop) ??
    toNumber(row.price) ??
    null;

  if (!sourceRate) {
    throw new Error("No se pudo interpretar el valor TRM de la API oficial");
  }

  const sourceDateRaw =
    row.vigenciadesde ?? row.fecha ?? row.date ?? row.updated_at ?? null;
  const sourceDate = sourceDateRaw ? new Date(String(sourceDateRaw)) : null;

  return {
    sourceRate,
    sourceDate: sourceDate && !Number.isNaN(sourceDate.getTime()) ? sourceDate : null,
    rawPayload: JSON.stringify(row),
  };
}

export async function updateUsdCopRateDaily(args?: { floorRate?: number }) {
  const floorRate = args?.floorRate ?? DEFAULT_FLOOR_RATE;
  const fetched = await fetchOfficialUsdCopRate();
  const floored = applyRateFloor(fetched.sourceRate, floorRate);

  const [inserted] = await db
    .insert(exchangeRates)
    .values({
      provider: PROVIDER_NAME,
      baseCurrency: "USD",
      targetCurrency: "COP",
      sourceRate: String(fetched.sourceRate),
      floorRate: String(floorRate),
      effectiveRate: String(floored.effectiveRate),
      adjustmentApplied: String(floored.adjustmentApplied),
      sourceDate: fetched.sourceDate,
      rawPayload: fetched.rawPayload,
    })
    .returning({
      createdAt: exchangeRates.createdAt,
    });

  return {
    provider: PROVIDER_NAME,
    sourceRate: fetched.sourceRate,
    floorRate,
    effectiveRate: floored.effectiveRate,
    adjustmentApplied: floored.adjustmentApplied,
    sourceDate: fetched.sourceDate ? fetched.sourceDate.toISOString() : null,
    createdAt: inserted?.createdAt ? new Date(inserted.createdAt).toISOString() : null,
  } satisfies ExchangeRateUpdate;
}

export async function getLatestUsdCopRate() {
  const [latest] = await db
    .select()
    .from(exchangeRates)
    .where(
      eq(exchangeRates.baseCurrency, "USD"),
    )
    .orderBy(desc(exchangeRates.createdAt))
    .limit(1);

  if (!latest) return null;

  return {
    provider: latest.provider,
    sourceRate: Number(latest.sourceRate ?? 0),
    floorRate: Number(latest.floorRate ?? 0),
    effectiveRate: Number(latest.effectiveRate ?? 0),
    adjustmentApplied: Number(latest.adjustmentApplied ?? 0),
    sourceDate: latest.sourceDate ? new Date(latest.sourceDate).toISOString() : null,
    createdAt: latest.createdAt ? new Date(latest.createdAt).toISOString() : null,
  } satisfies ExchangeRateUpdate;
}

export function convertUsdToCopWithFloor(args: {
  usdAmount: number;
  sourceRate: number;
  floorRate?: number;
}) {
  const floorRate = args.floorRate ?? DEFAULT_FLOOR_RATE;
  const floored = applyRateFloor(args.sourceRate, floorRate);
  const copAmount = args.usdAmount * floored.effectiveRate;

  return {
    usdAmount: args.usdAmount,
    sourceRate: args.sourceRate,
    floorRate,
    effectiveRate: floored.effectiveRate,
    adjustmentApplied: floored.adjustmentApplied,
    copAmount,
  };
}
