import { and, between, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import {
  advisorCommissionRates,
  cashReceipts,
  colillasPago,
  hcmPreAsientos,
} from "@/src/db/erp/schema";

const periodSchema = z.string().regex(/^\d{4}-\d{2}$/);

export interface CommissionDetail {
  reciboCode: string;
  monto: number;
  comision: number;
  fecha: string;
}

export interface PeriodCommissionResult {
  totalVentas: number;
  comision: number;
  detalle: CommissionDetail[];
}

function parseMoney(value: unknown): number {
  const n = Number(value ?? 0);

  return Number.isFinite(n) ? n : 0;
}

function toMoney(value: number): string {
  return value.toFixed(2);
}

function getPeriodRange(period: string): [string, string] {
  const validated = periodSchema.parse(period);
  const [year, month] = validated.split("-").map(Number);
  const start = `${validated}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${validated}-${String(lastDay).padStart(2, "0")}`;

  return [start, end];
}

export async function calcularComisionPeriodo(
  employeeId: string,
  period: string,
): Promise<PeriodCommissionResult> {
  const normalizedPeriod = periodSchema.parse(period);

  const [asesor] = await db
    .select({
      rate: advisorCommissionRates.rate,
    })
    .from(advisorCommissionRates)
    .where(
      and(
        eq(advisorCommissionRates.employeeId, employeeId),
        eq(advisorCommissionRates.isActive, true),
      ),
    )
    .limit(1);

  if (!asesor) {
    return { totalVentas: 0, comision: 0, detalle: [] };
  }

  const [periodoStart, periodoEnd] = getPeriodRange(normalizedPeriod);

  const recibos = await db
    .select({
      reciboCode: cashReceipts.receiptCode,
      amountReceived: cashReceipts.amountReceived,
      receiptDate: cashReceipts.receiptDate,
    })
    .from(cashReceipts)
    .where(
      and(
        eq(cashReceipts.createdBy, employeeId),
        eq(cashReceipts.status, "CONFIRMED"),
        between(cashReceipts.receiptDate, periodoStart, periodoEnd),
      ),
    );

  if (recibos.length === 0) {
    return { totalVentas: 0, comision: 0, detalle: [] };
  }

  const rate = parseMoney(asesor.rate);
  const totalVentas = recibos.reduce(
    (sum, item) => sum + parseMoney(item.amountReceived),
    0,
  );
  const comision = totalVentas * rate;

  const detalle: CommissionDetail[] = recibos.map((item) => {
    const monto = parseMoney(item.amountReceived);

    return {
      reciboCode: String(item.reciboCode ?? ""),
      monto,
      comision: monto * rate,
      fecha: String(item.receiptDate ?? ""),
    };
  });

  return { totalVentas, comision, detalle };
}

export async function aplicarComisionEnColilla(
  employeeId: string,
  period: string,
): Promise<void> {
  const normalizedPeriod = periodSchema.parse(period);
  const resultado = await calcularComisionPeriodo(employeeId, normalizedPeriod);

  if (resultado.comision <= 0) return;

  const commissionAmount = toMoney(resultado.comision);

  const [colilla] = await db
    .insert(colillasPago)
    .values({
      employeeId,
      period: normalizedPeriod,
      status: "BORRADOR",
      salarioBasico: "0",
      auxilioTransporte: "0",
      comisiones: commissionAmount,
      totalDevengado: commissionAmount,
      saludEmpleado: "0",
      pensionEmpleado: "0",
      retencionFuente: "0",
      totalDeducciones: "0",
      netoAPagar: commissionAmount,
    })
    .onConflictDoUpdate({
      target: [colillasPago.employeeId, colillasPago.period],
      set: {
        comisiones: commissionAmount,
        totalDevengado: sql`${colillasPago.totalDevengado} + ${commissionAmount}::numeric`,
        netoAPagar: sql`${colillasPago.netoAPagar} + ${commissionAmount}::numeric`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: colillasPago.id });

  await db.insert(hcmPreAsientos).values({
    origen: "comision",
    origenId: colilla.id,
    employeeId,
    period: normalizedPeriod,
    cuentaDebito: "5230",
    cuentaCredito: "2335",
    valor: commissionAmount,
    concepto: `Comision ventas periodo ${normalizedPeriod}`,
    status: "PENDIENTE",
  });
}
