import type { EstadoProceso, ProcessRoleConfig } from "./mes-types";

import React from "react";
import { Role } from "@/src/db/enums";
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
    role: Role.OPERARIO,
    operationType: "MONTAJE",
  },
  plotter: {
    label: "Plotter",
    role: Role.OPERARIO,
    operationType: "PLOTTER",
  },
  sublimacion: {
    label: "Sublimación",
    role: Role.OPERARIO,
    operationType: "SUBLIMACION",
  },
  corte: {
    label: "Corte",
    role: Role.OPERARIO,
    operationType: "CORTE_MANUAL",
  },
  integracion: {
    label: "Integración",
    role: Role.OPERARIO_INTEGRACION_CALIDAD,
    operationType: "INTEGRACION",
  },
  confeccion: {
    label: "Confección",
    role: Role.CONFECCIONISTA,
    operationType: "CONFECCION",
  },
  empaque: { label: "Empaque", role: Role.EMPAQUE, operationType: "EMPAQUE" },
  despacho: {
    label: "Despacho",
    role: Role.OPERARIO_DESPACHO,
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
