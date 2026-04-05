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

export type MesAccessMachineOption = {
  id: string;
  name: string;
};

export type MesAccessProcessOption = {
  key:
    | "montaje"
    | "plotter"
    | "calandra"
    | "sublimacion"
    | "corte_laser"
    | "corte_manual"
    | "integracion"
    | "despacho";
  label: string;
  mesProcess: "montaje" | "plotter" | "sublimacion" | "corte" | "integracion" | "despacho";
  operationType:
    | "MONTAJE"
    | "PLOTTER"
    | "CALANDRA"
    | "SUBLIMACION"
    | "CORTE_LASER"
    | "CORTE_MANUAL"
    | "INTEGRACION"
    | "DESPACHO";
  requiresMachine: boolean;
  machines: MesAccessMachineOption[];
};

export const MES_ACCESS_PROCESS_OPTIONS: MesAccessProcessOption[] = [
  {
    key: "montaje",
    label: "Montaje",
    mesProcess: "montaje",
    operationType: "MONTAJE",
    requiresMachine: false,
    machines: [],
  },
  {
    key: "plotter",
    label: "Plotter",
    mesProcess: "plotter",
    operationType: "PLOTTER",
    requiresMachine: true,
    machines: [{ id: "plotter-all", name: "Todas" }],
  },
  {
    key: "calandra",
    label: "Calandra",
    mesProcess: "sublimacion",
    operationType: "CALANDRA",
    requiresMachine: true,
    machines: [
      { id: "calandra-1", name: "Calandra 1" },
      { id: "calandra-2", name: "Calandra 2" },
      { id: "calandra-3", name: "Calandra 3" },
    ],
  },
  {
    key: "sublimacion",
    label: "Sublimación",
    mesProcess: "sublimacion",
    operationType: "SUBLIMACION",
    requiresMachine: true,
    machines: [
      { id: "sublimacion-1", name: "Sublimadora 1" },
      { id: "sublimacion-2", name: "Sublimadora 2" },
      { id: "sublimacion-3", name: "Sublimadora 3" },
    ],
  },
  {
    key: "corte_laser",
    label: "Corte láser",
    mesProcess: "corte",
    operationType: "CORTE_LASER",
    requiresMachine: true,
    machines: [
      { id: "corte-laser-1", name: "Corte láser 1" },
      { id: "corte-laser-2", name: "Corte láser 2" },
      { id: "corte-laser-3", name: "Corte láser 3" },
    ],
  },
  {
    key: "corte_manual",
    label: "Corte manual",
    mesProcess: "corte",
    operationType: "CORTE_MANUAL",
    requiresMachine: true,
    machines: [{ id: "corte-manual-1", name: "Corte manual 1" }],
  },
  {
    key: "integracion",
    label: "Integración",
    mesProcess: "integracion",
    operationType: "INTEGRACION",
    requiresMachine: false,
    machines: [],
  },
  {
    key: "despacho",
    label: "Despacho",
    mesProcess: "despacho",
    operationType: "DESPACHO",
    requiresMachine: false,
    machines: [],
  },
];

export function getMesAccessProcessOption(processKey: string | null | undefined) {
  return (
    MES_ACCESS_PROCESS_OPTIONS.find((option) => option.key === processKey) ??
    null
  );
}

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
