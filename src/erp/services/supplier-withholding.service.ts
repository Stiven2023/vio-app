import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { supplierWithholdingRates, suppliers } from "@/src/db/erp/schema";

export interface RetencionesSupplier {
  rteFuente: number;
  rteIVA: number;
  rteICA: number;
  total: number;
  aplicaRteFuente: boolean;
}

const previewInputSchema = z.object({
  supplierId: z.string().uuid(),
  subtotal: z.number().nonnegative(),
  serviceType: z.string().trim().min(1).max(80),
});

function asNumber(value: unknown): number {
  const n = Number(value ?? 0);

  return Number.isFinite(n) ? n : 0;
}

function toRounded(value: number): number {
  return Math.round(value);
}

export async function calcularRetencionesSuplier(
  supplierId: string,
  subtotal: number,
  serviceType: string,
): Promise<RetencionesSupplier> {
  const parsed = previewInputSchema.parse({
    supplierId,
    subtotal,
    serviceType,
  });

  const [supplier] = await db
    .select({ taxRegime: suppliers.taxRegime })
    .from(suppliers)
    .where(eq(suppliers.id, parsed.supplierId))
    .limit(1);

  if (!supplier) {
    throw new Error("SUPPLIER_NOT_FOUND");
  }

  const today = new Date().toISOString().slice(0, 10);

  const [rate] = await db
    .select({
      rteFuenteRate: supplierWithholdingRates.rteFuenteRate,
      rteIvaRate: supplierWithholdingRates.rteIvaRate,
      rteIcaRate: supplierWithholdingRates.rteIcaRate,
      minBaseRteFuente: supplierWithholdingRates.minBaseRteFuente,
    })
    .from(supplierWithholdingRates)
    .where(
      and(
        eq(supplierWithholdingRates.taxRegime, supplier.taxRegime),
        eq(supplierWithholdingRates.serviceType, parsed.serviceType),
        eq(supplierWithholdingRates.isActive, true),
        lte(supplierWithholdingRates.validFrom, today),
        or(
          isNull(supplierWithholdingRates.validTo),
          gte(supplierWithholdingRates.validTo, today),
        ),
      ),
    )
    .orderBy(desc(supplierWithholdingRates.validFrom))
    .limit(1);

  if (!rate) {
    return {
      rteFuente: 0,
      rteIVA: 0,
      rteICA: 0,
      total: 0,
      aplicaRteFuente: false,
    };
  }

  const minBase = asNumber(rate.minBaseRteFuente);
  const aplicaRteFuente = parsed.subtotal >= minBase;
  const rteFuente = aplicaRteFuente
    ? parsed.subtotal * asNumber(rate.rteFuenteRate)
    : 0;
  const ivaBase = parsed.subtotal * 0.19;
  const rteIVA = ivaBase * asNumber(rate.rteIvaRate);
  const rteICA = parsed.subtotal * asNumber(rate.rteIcaRate);

  return {
    rteFuente: toRounded(rteFuente),
    rteIVA: toRounded(rteIVA),
    rteICA: toRounded(rteICA),
    total: toRounded(rteFuente + rteIVA + rteICA),
    aplicaRteFuente,
  };
}
