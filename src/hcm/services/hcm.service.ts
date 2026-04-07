import { and, eq, lte, gte } from "drizzle-orm";

import { db } from "@/src/db";
import {
  colillasPago,
  hcmPreAsientos,
  solicitudesHorasExtras,
  employeeLeaves,
} from "@/src/db/erp/schema";
import {
  hcmLiquidarColillaSchema,
  hcmSolicitudHoraExtraSchema,
  type HcmLiquidarColillaInput,
  type HcmSolicitudHoraExtraInput,
} from "@/src/utils/hcm-contract";

export const CONSTANTES_2025 = {
  SMMLV: 1423500,
  AUXILIO_TRANSPORTE: 200000,
  UVT: 47065,
  SALUD_EMPLEADO: 0.04,
  SALUD_EMPLEADOR: 0.085,
  PENSION_EMPLEADO: 0.04,
  PENSION_EMPLEADOR: 0.12,
  CAJA_COMPENSACION: 0.04,
  ICBF: 0.03,
  SENA: 0.02,
} as const;

export const RECARGOS_HE = {
  DIURNA_ORDINARIA: 0.25,
  NOCTURNA_ORDINARIA: 0.75,
  DOMINICAL_DIURNA: 0.75,
  DOMINICAL_NOCTURNA: 1.1,
  FESTIVO_DIURNO: 0.75,
  FESTIVO_NOCTURNO: 1.1,
} as const;

const ARL_TARIFAS = {
  1: 0.00522,
  2: 0.01044,
  3: 0.02436,
  4: 0.0435,
  5: 0.0696,
} as const;

function toMoney(value: number): string {
  return value.toFixed(2);
}

export function calcularAuxilioTransporte(salario: number): number {
  return salario <= CONSTANTES_2025.SMMLV * 2
    ? CONSTANTES_2025.AUXILIO_TRANSPORTE
    : 0;
}

export function calcularRetencionFuente(ingresoBruto: number): number {
  const uvts = ingresoBruto / CONSTANTES_2025.UVT;

  if (uvts < 95) return 0;
  if (uvts < 150) return ingresoBruto * 0.19;
  if (uvts < 360) return ingresoBruto * 0.28;
  if (uvts < 640) return ingresoBruto * 0.33;

  return ingresoBruto * 0.35;
}

export function calcularValorHoraExtra(
  salario: number,
  horas: number,
  tipo: keyof typeof RECARGOS_HE,
): number {
  const valorHora = salario / 240;

  return valorHora * horas * (1 + RECARGOS_HE[tipo]);
}

function calcularARL(salario: number, claseRiesgo: 1 | 2 | 3 | 4 | 5): number {
  return salario * ARL_TARIFAS[claseRiesgo];
}

async function crearPreAsientoNomina(params: {
  employeeId: string;
  period: string;
  colillaId: string;
  valorNeto: number;
  valorAportes: number;
  retencion: number;
}) {
  const { employeeId, period, colillaId, valorNeto, valorAportes, retencion } =
    params;

  await db.insert(hcmPreAsientos).values({
    origen: "colilla",
    origenId: colillaId,
    employeeId,
    period,
    cuentaDebito: "5105",
    cuentaCredito: "2335",
    valor: toMoney(valorNeto),
    concepto: `Nomina periodo ${period}`,
    status: "PENDIENTE",
  });

  if (valorAportes > 0) {
    await db.insert(hcmPreAsientos).values({
      origen: "colilla_aportes",
      origenId: colillaId,
      employeeId,
      period,
      cuentaDebito: "5109",
      cuentaCredito: "2370",
      valor: toMoney(valorAportes),
      concepto: `Aportes patronales periodo ${period}`,
      status: "PENDIENTE",
    });
  }

  if (retencion > 0) {
    await db.insert(hcmPreAsientos).values({
      origen: "colilla_retencion",
      origenId: colillaId,
      employeeId,
      period,
      cuentaDebito: "2335",
      cuentaCredito: "2365",
      valor: toMoney(retencion),
      concepto: `Retencion en la fuente periodo ${period}`,
      status: "PENDIENTE",
    });
  }
}

export async function liquidarColilla(input: HcmLiquidarColillaInput) {
  const payload = hcmLiquidarColillaSchema.parse(input);

  const transporte = calcularAuxilioTransporte(payload.salarioBase);
  const totalDevengado =
    payload.salarioBase +
    transporte +
    payload.horasExtrasValor +
    payload.comisiones +
    payload.bonificaciones +
    payload.vacacionesDisfrutadas;

  const saludEmp = payload.salarioBase * CONSTANTES_2025.SALUD_EMPLEADO;
  const pensionEmp = payload.salarioBase * CONSTANTES_2025.PENSION_EMPLEADO;
  const retencion = calcularRetencionFuente(
    totalDevengado - saludEmp - pensionEmp,
  );

  const totalDeducciones =
    saludEmp + pensionEmp + retencion + payload.embargos + payload.libranzas;

  const netoAPagar = totalDevengado - totalDeducciones;

  const saludEmpleador = payload.salarioBase * CONSTANTES_2025.SALUD_EMPLEADOR;
  const pensionEmpleador =
    payload.salarioBase * CONSTANTES_2025.PENSION_EMPLEADOR;
  const arl = calcularARL(payload.salarioBase, payload.claseRiesgoARL);
  const cajaCom = payload.salarioBase * CONSTANTES_2025.CAJA_COMPENSACION;
  const icbf = payload.salarioBase * CONSTANTES_2025.ICBF;
  const sena = payload.salarioBase * CONSTANTES_2025.SENA;

  const [colilla] = await db
    .insert(colillasPago)
    .values({
      employeeId: payload.employeeId,
      period: payload.period,
      status: "BORRADOR",
      salarioBasico: toMoney(payload.salarioBase),
      auxilioTransporte: toMoney(transporte),
      comisiones: toMoney(payload.comisiones),
      totalDevengado: toMoney(totalDevengado),
      saludEmpleado: toMoney(saludEmp),
      pensionEmpleado: toMoney(pensionEmp),
      retencionFuente: toMoney(retencion),
      totalDeducciones: toMoney(totalDeducciones),
      netoAPagar: toMoney(netoAPagar),
      generadoPor: payload.generadoPor,
      bankId: payload.bankId || null,
    })
    .onConflictDoUpdate({
      target: [colillasPago.employeeId, colillasPago.period],
      set: {
        salarioBasico: toMoney(payload.salarioBase),
        auxilioTransporte: toMoney(transporte),
        comisiones: toMoney(payload.comisiones),
        totalDevengado: toMoney(totalDevengado),
        saludEmpleado: toMoney(saludEmp),
        pensionEmpleado: toMoney(pensionEmp),
        retencionFuente: toMoney(retencion),
        totalDeducciones: toMoney(totalDeducciones),
        netoAPagar: toMoney(netoAPagar),
        updatedAt: new Date(),
      },
    })
    .returning({
      id: colillasPago.id,
      employeeId: colillasPago.employeeId,
      period: colillasPago.period,
      netoAPagar: colillasPago.netoAPagar,
      status: colillasPago.status,
    });

  await crearPreAsientoNomina({
    employeeId: payload.employeeId,
    period: payload.period,
    colillaId: colilla.id,
    valorNeto: netoAPagar,
    valorAportes:
      saludEmpleador + pensionEmpleador + arl + cajaCom + icbf + sena,
    retencion,
  });

  return colilla;
}

export async function crearSolicitudHoraExtra(
  input: HcmSolicitudHoraExtraInput,
) {
  const payload = hcmSolicitudHoraExtraSchema.parse(input);

  const [created] = await db
    .insert(solicitudesHorasExtras)
    .values({
      employeeId: payload.employeeId,
      supervisorId: payload.supervisorId,
      fecha: payload.fecha,
      horaInicio: payload.horaInicio,
      horaFin: payload.horaFin,
      tipo: payload.tipo,
      totalHoras: toMoney(payload.totalHoras),
      actividad: payload.actividad,
      orderItemId: payload.orderItemId || null,
      employeeRequestId: payload.employeeRequestId || null,
      period: payload.period || null,
      status: "PENDIENTE",
    })
    .returning({
      id: solicitudesHorasExtras.id,
      employeeId: solicitudesHorasExtras.employeeId,
      status: solicitudesHorasExtras.status,
      totalHoras: solicitudesHorasExtras.totalHoras,
    });

  return created;
}

export async function verificarDisponibilidad(
  employeeId: string,
  fecha: string,
) {
  const [licencia] = await db
    .select({
      id: employeeLeaves.id,
      leaveType: employeeLeaves.leaveType,
      startDate: employeeLeaves.startDate,
      endDate: employeeLeaves.endDate,
    })
    .from(employeeLeaves)
    .where(
      and(
        eq(employeeLeaves.employeeId, employeeId),
        lte(employeeLeaves.startDate, fecha),
        gte(employeeLeaves.endDate, fecha),
      ),
    )
    .limit(1);

  if (!licencia) {
    return { disponible: true as const };
  }

  return {
    disponible: false as const,
    motivo: `Empleado con licencia ${licencia.leaveType} del ${licencia.startDate} al ${licencia.endDate}`,
  };
}
