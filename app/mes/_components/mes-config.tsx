import type { EstadoProceso, ProcessRoleConfig } from "./mes-types";

import React from "react";
import { MdCheckCircle, MdSchedule, MdWarning } from "react-icons/md";

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
  montaje: {
    label: "Montaje",
    role: "OPERARIO",
    operationType: "MONTAJE",
  },
  plotter: {
    label: "Plotter",
    role: "OPERARIO",
    operationType: "PLOTTER",
  },
  sublimacion: {
    label: "Sublimation",
    role: "OPERARIO",
    operationType: "SUBLIMACION",
  },
  corte: {
    label: "Cutting",
    role: "OPERARIO",
    operationType: "CORTE_MANUAL",
  },
  integracion: {
    label: "Integration",
    role: "OPERARIO_INTEGRACION_CALIDAD",
    operationType: "INTEGRACION",
  },
  confeccion: {
    label: "Sewing",
    role: "CONFECCIONISTA",
    operationType: "CONFECCION",
  },
  empaque: { label: "Packing", role: "EMPAQUE", operationType: "EMPAQUE" },
  despacho: {
    label: "Dispatch",
    role: "OPERARIO_DESPACHO",
    operationType: "DESPACHO",
  },
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
    label: "Completed",
    color: "success",
    icon: <MdCheckCircle size={12} />,
  },
  en_proceso: {
    label: "In progress",
    color: "primary",
    icon: <MdSchedule size={12} />,
  },
  pendiente: {
    label: "Pending",
    color: "default",
    icon: <MdSchedule size={12} />,
  },
  reponer: {
    label: "Restock",
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
