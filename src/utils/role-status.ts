const STATUS_ROLE_MAP: Record<string, string[]> = {
  PENDIENTE: ["ADMINISTRADOR", "ASESOR", "COMPRAS"],
  APROBACION_INICIAL: ["ADMINISTRADOR", "ASESOR", "COMPRAS"],
  PENDIENTE_PRODUCCION: ["ADMINISTRADOR", "ASESOR", "COMPRAS", "OPERARIO_INVENTARIO"],
  EN_MONTAJE: ["OPERARIO_MONTAJE", "ADMINISTRADOR"],
  EN_IMPRESION: ["OPERARIO_IMPRESION", "ADMINISTRADOR"],
  SUBLIMACION: ["OPERARIO_SUBLIMACION", "ADMINISTRADOR"],
  CORTE_MANUAL: ["OPERARIO_CORTE_MANUAL", "ADMINISTRADOR"],
  CORTE_LASER: ["OPERARIO_CORTE_LASER", "ADMINISTRADOR"],
  PENDIENTE_CONFECCION: ["ADMINISTRADOR", "OPERARIO_INTEGRACION"],
  CONFECCION: ["ADMINISTRADOR", "OPERARIO_INTEGRACION", "OPERARIO_EMPAQUE"],
  EN_BODEGA: ["ADMINISTRADOR", "OPERARIO_EMPAQUE", "OPERARIO_INVENTARIO"],
  EMPAQUE: ["ADMINISTRADOR", "OPERARIO_EMPAQUE"],
  ENVIADO: ["ADMINISTRADOR", "OPERARIO_EMPAQUE"],
  COMPLETADO: ["ADMINISTRADOR", "OPERARIO_EMPAQUE"],
  CANCELADO: ["ADMINISTRADOR"],
};

const EXTRA_STATUSES = [
  "REVISION_ADMIN",
  "EN_REVISION_CAMBIO",
  "APROBADO_CAMBIO",
  "RECHAZADO_CAMBIO",
] as const;

const ALL_STATUSES = [
  ...Object.keys(STATUS_ROLE_MAP),
  ...EXTRA_STATUSES,
] as const;

const ALL_STATUS_SET = new Set(ALL_STATUSES);

const leaderAllowed = ALL_STATUSES.filter((status) => status !== "CANCELADO");

export function getAllowedStatusesForRole(role: string | null) {
  if (!role) return [] as string[];
  if (role === "ADMINISTRADOR") return ALL_STATUSES.slice();
  if (role === "LIDER_DE_PROCESOS") return leaderAllowed.slice();

  return Object.entries(STATUS_ROLE_MAP)
    .filter(([, roles]) => roles.includes(role))
    .map(([status]) => status);
}

export function canRoleChangeToStatus(role: string | null, status: string) {
  if (!role) return false;
  if (!ALL_STATUS_SET.has(status)) return false;

  const allowed = getAllowedStatusesForRole(role);

  return allowed.includes(status);
}

export function isOperarioRole(role: string | null) {
  if (!role) return false;

  return role.startsWith("OPERARIO_");
}
