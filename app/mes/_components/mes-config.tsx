import React from "react";
import { MdCheckCircle, MdSchedule, MdWarning } from "react-icons/md";

import type { EstadoProceso, ProcessRoleConfig } from "./mes-types";

export const PROCESO_PREFIX: Record<string, string> = {
  montaje: "MO",
  plotter: "PLO",
  sublimacion: "SUB",
  corte: "COR",
  integracion: "INT",
  confeccion: "CON",
  empaque: "EMP",
  despacho: "DES",
};

export const PROCESS_ROLE_CONFIG: Record<string, ProcessRoleConfig> = {
  montaje: { label: "Montaje", role: "OPERARIO_MONTAJE", operationType: "MONTAJE" },
  plotter: { label: "Plotter", role: "OPERARIO_FLOTER", operationType: "PLOTTER" },
  sublimacion: { label: "Sublimación", role: "OPERARIO_SUBLIMACION", operationType: "SUBLIMACION" },
  corte: { label: "Corte", role: "OPERARIO_CORTE_MANUAL", operationType: "CORTE_MANUAL" },
  integracion: {
    label: "Integración",
    role: "OPERARIO_INTEGRACION_CALIDAD",
    operationType: "INTEGRACION",
  },
  confeccion: { label: "Confección", role: "CONFECCIONISTA", operationType: "CONFECCION" },
  empaque: { label: "Empaque", role: "EMPAQUE", operationType: "EMPAQUE" },
  despacho: { label: "Despacho", role: "OPERARIO_DESPACHO", operationType: "DESPACHO" },
};

export const ESTADO_CONFIG: Record<
  EstadoProceso,
  {
    label: string;
    color: "success" | "primary" | "default" | "danger";
    icon: React.ReactNode;
  }
> = {
  completado: {
    label: "Completado",
    color: "success",
    icon: <MdCheckCircle size={12} />,
  },
  en_proceso: {
    label: "En proceso",
    color: "primary",
    icon: <MdSchedule size={12} />,
  },
  pendiente: {
    label: "Pendiente",
    color: "default",
    icon: <MdSchedule size={12} />,
  },
  reponer: {
    label: "Reponer",
    color: "danger",
    icon: <MdWarning size={12} />,
  },
};

export const PEDIDO_ESTADO_CONFIG: Record<
  string,
  { color: "success" | "primary" | "warning" | "danger" | "default" }
> = {
  "SIN TRAMITAR": { color: "default" },
  "EN PROCESO": { color: "primary" },
  COMPLETADO: { color: "success" },
  TARDE: { color: "danger" },
};
