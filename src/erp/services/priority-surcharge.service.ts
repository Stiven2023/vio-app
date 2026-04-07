import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { journalEntryEngine } from "@/src/accounting/journal-engine.service";
import { db } from "@/src/db";
import { orders, prioritySurchargeConfig } from "@/src/db/erp/schema";

const surchargeInputSchema = z.object({
  orderId: z.string().uuid(),
  surchargeConfigId: z.string().uuid(),
  empleadoQuePriorizaId: z.string().uuid(),
  razon: z.string().trim().min(3).max(500),
});

export interface AplicarSurchargeInput {
  orderId: string;
  surchargeConfigId: string;
  empleadoQuePriorizaId: string;
  razon: string;
}

export function calcularSurcharge(
  orderTotal: number,
  chargeType: "PORCENTAJE" | "FIJO",
  chargeValue: number,
): number {
  if (chargeType === "FIJO") {
    return chargeValue;
  }

  return orderTotal * chargeValue;
}

function asMoney(value: unknown): number {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

export async function aplicarSurchargePrioritario(
  rawInput: AplicarSurchargeInput,
) {
  const input = surchargeInputSchema.parse(rawInput);

  const [order] = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      total: orders.total,
      prioritySurchargeApplied: orders.prioritySurchargeApplied,
    })
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);

  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  if (order.prioritySurchargeApplied) {
    throw new Error("SURCHARGE_ALREADY_APPLIED");
  }

  const [config] = await db
    .select({
      id: prioritySurchargeConfig.id,
      name: prioritySurchargeConfig.name,
      chargeType: prioritySurchargeConfig.chargeType,
      chargeValue: prioritySurchargeConfig.chargeValue,
      revenueAccount: prioritySurchargeConfig.revenueAccount,
    })
    .from(prioritySurchargeConfig)
    .where(
      and(
        eq(prioritySurchargeConfig.id, input.surchargeConfigId),
        eq(prioritySurchargeConfig.isActive, true),
      ),
    )
    .limit(1);

  if (!config) {
    throw new Error("SURCHARGE_CONFIG_NOT_FOUND");
  }

  const orderTotal = asMoney(order.total);
  const chargeType =
    String(config.chargeType) === "FIJO" ? "FIJO" : "PORCENTAJE";
  const surchargeAmount = calcularSurcharge(
    orderTotal,
    chargeType,
    asMoney(config.chargeValue),
  );

  await db
    .update(orders)
    .set({
      prioritySurchargeApplied: true,
      prioritySurchargeAmount: surchargeAmount.toFixed(2),
      prioritySurchargeReason: `${config.name}: ${input.razon}`,
      prioritySurchargeAppliedBy: input.empleadoQuePriorizaId,
      prioritySurchargeAppliedAt: new Date(),
    })
    .where(eq(orders.id, input.orderId));

  const entryId = await journalEntryEngine.processEvent({
    sourceType: "SURCHARGE_PRIORITARIO",
    event: "APLICADO",
    sourceId: input.orderId,
    fecha: new Date().toISOString().slice(0, 10),
    createdBy: input.empleadoQuePriorizaId,
    data: {
      surchargeAmount: surchargeAmount.toFixed(2),
      surchargeLabel: config.name,
      orderCode: order.orderCode,
    },
  });

  await db
    .update(orders)
    .set({ prioritySurchargeEntryId: entryId })
    .where(eq(orders.id, input.orderId));

  return {
    orderId: input.orderId,
    orderCode: order.orderCode,
    orderTotal,
    surchargeAmount,
    surchargeLabel: config.name,
    cuentaDebito: "1305",
    cuentaCredito: config.revenueAccount,
    entryId,
  };
}
