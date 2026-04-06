import { normalizeText } from "@/src/imports/historical-excel/helpers";

export const seguimientoOperationTypes = [
  "MONTAJE",
  "PLOTTER",
  "SUBLIMACION",
  "CALANDRA",
  "CORTE_LASER",
  "CORTE_MANUAL",
  "CONFECCION",
  "EMPAQUE",
  "INTEGRACION",
  "DESPACHO",
] as const;

export const seguimientoRoleAreas = [
  "OPERARIOS",
  "CONFECCIONISTAS",
  "MENSAJERIA",
  "EMPAQUE",
] as const;

export const seguimientoProcessCodes = ["P", "S", "C"] as const;

export type SeguimientoOperationType = (typeof seguimientoOperationTypes)[number];
export type SeguimientoRoleArea = (typeof seguimientoRoleAreas)[number];
export type SeguimientoProcessCode = (typeof seguimientoProcessCodes)[number];

export function resolveSeguimientoOperationType(
  rawValue: unknown,
  sheetName?: string | null,
): SeguimientoOperationType | null {
  const normalized = normalizeText(rawValue).toUpperCase();
  const normalizedSheet = normalizeText(sheetName).toUpperCase();
  const combined = `${normalized} ${normalizedSheet}`.trim();

  if (!combined) {
    return null;
  }

  if (combined.includes("CALANDRA")) {
    return "CALANDRA";
  }

  if (combined.includes("PLOTTER")) {
    return "PLOTTER";
  }

  if (combined.includes("SUBLIM")) {
    return "SUBLIMACION";
  }

  if (combined.includes("LASER")) {
    return "CORTE_LASER";
  }

  if (combined.includes("CORTE MANUAL") || combined.includes("MANUAL")) {
    return "CORTE_MANUAL";
  }

  if (combined.includes("CORTE")) {
    return "CORTE_MANUAL";
  }

  if (combined.includes("CONFECCION")) {
    return "CONFECCION";
  }

  if (combined.includes("EMPAQUE")) {
    return "EMPAQUE";
  }

  if (combined.includes("INTEGRACION")) {
    return "INTEGRACION";
  }

  if (combined.includes("DESPACH")) {
    return "DESPACHO";
  }

  if (combined.includes("MONTAJ")) {
    return "MONTAJE";
  }

  return null;
}

export function resolveSeguimientoRoleArea(
  rawValue: unknown,
  operationType: SeguimientoOperationType | null,
): SeguimientoRoleArea {
  const normalized = normalizeText(rawValue).toUpperCase();

  if (normalized.includes("MENSAJ")) {
    return "MENSAJERIA";
  }

  if (normalized.includes("EMPAQUE")) {
    return "EMPAQUE";
  }

  if (normalized.includes("CONFECCION")) {
    return "CONFECCIONISTAS";
  }

  if (operationType === "DESPACHO") {
    return "MENSAJERIA";
  }

  if (operationType === "EMPAQUE") {
    return "EMPAQUE";
  }

  if (operationType === "CONFECCION") {
    return "CONFECCIONISTAS";
  }

  return "OPERARIOS";
}

export function resolveSeguimientoProcessCode(
  rawValue: unknown,
): SeguimientoProcessCode {
  const normalized = normalizeText(rawValue).toUpperCase();

  if (normalized === "S" || normalized.startsWith("SEC")) {
    return "S";
  }

  if (normalized === "C" || normalized.startsWith("CON")) {
    return "C";
  }

  return "P";
}

export function isSeguimientoLogSheetCandidate(sheetName: string) {
  const normalized = normalizeText(sheetName).toUpperCase();

  return /(SEGUIMIENTO|PRODUCCION|MONTAJ|PLOTTER|SUBLIM|CALANDRA|CORTE|CONFECCION|EMPAQUE|INTEGRACION|DESPACH|OPERARIO|LOG)/.test(
    normalized,
  );
}