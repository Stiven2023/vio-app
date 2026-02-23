const STATUS_ROLE_MAP: Record<string, string[]> = {
  PENDIENTE: [
    "ADMINISTRADOR",
    "ASESOR",
    "LIDER_SUMINISTROS",
    "COMPRA_NACIONAL",
    "COMPRA_INTERNACIONAL",
  ],
  APROBACION_INICIAL: [
    "ADMINISTRADOR",
    "ASESOR",
    "LIDER_SUMINISTROS",
    "COMPRA_NACIONAL",
    "COMPRA_INTERNACIONAL",
  ],
  PENDIENTE_PRODUCCION: [
    "ADMINISTRADOR",
    "ASESOR",
    "LIDER_SUMINISTROS",
    "COMPRA_NACIONAL",
    "COMPRA_INTERNACIONAL",
    "OPERARIO_BODEGA",
  ],
  EN_MONTAJE: ["OPERARIO_MONTAJE", "ADMINISTRADOR"],
  EN_IMPRESION: ["OPERARIO_FLOTER", "ADMINISTRADOR"],
  SUBLIMACION: ["OPERARIO_SUBLIMACION", "ADMINISTRADOR"],
  CORTE_MANUAL: ["OPERARIO_CORTE_MANUAL", "ADMINISTRADOR"],
  CORTE_LASER: ["OPERARIO_CORTE_LASER", "ADMINISTRADOR"],
  PENDIENTE_CONFECCION: ["ADMINISTRADOR", "OPERARIO_INTEGRACION_CALIDAD"],
  CONFECCION: ["ADMINISTRADOR", "OPERARIO_INTEGRACION_CALIDAD", "EMPAQUE"],
  EN_BODEGA: ["ADMINISTRADOR", "EMPAQUE", "OPERARIO_BODEGA"],
  EMPAQUE: ["ADMINISTRADOR", "EMPAQUE"],
  ENVIADO: ["ADMINISTRADOR", "EMPAQUE"],
  COMPLETADO: ["ADMINISTRADOR", "EMPAQUE"],
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

const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDIENTE: ["REVISION_ADMIN", "APROBACION_INICIAL"],
  REVISION_ADMIN: ["APROBACION_INICIAL"],
  APROBACION_INICIAL: ["PENDIENTE_PRODUCCION", "EN_REVISION_CAMBIO"],
  PENDIENTE_PRODUCCION: [
    "EN_MONTAJE",
    "EN_IMPRESION",
    "SUBLIMACION",
    "CORTE_MANUAL",
    "CORTE_LASER",
    "PENDIENTE_CONFECCION",
  ],
  EN_MONTAJE: ["PENDIENTE_CONFECCION"],
  EN_IMPRESION: ["PENDIENTE_CONFECCION"],
  SUBLIMACION: ["PENDIENTE_CONFECCION"],
  CORTE_MANUAL: ["PENDIENTE_CONFECCION"],
  CORTE_LASER: ["PENDIENTE_CONFECCION"],
  PENDIENTE_CONFECCION: ["CONFECCION"],
  CONFECCION: ["EN_BODEGA"],
  EN_BODEGA: ["EMPAQUE"],
  EMPAQUE: ["ENVIADO"],
  ENVIADO: ["COMPLETADO"],
  EN_REVISION_CAMBIO: ["APROBADO_CAMBIO", "RECHAZADO_CAMBIO"],
  APROBADO_CAMBIO: ["PENDIENTE_PRODUCCION"],
  RECHAZADO_CAMBIO: ["PENDIENTE_PRODUCCION"],
  COMPLETADO: [],
  CANCELADO: [],
};

export function getAllowedStatusesForRole(role: string | null) {
  if (!role) return [] as string[];
  if (role === "ADMINISTRADOR") return ALL_STATUSES.slice();
  if (role === "LIDER_OPERACIONAL") return leaderAllowed.slice();

  return Object.entries(STATUS_ROLE_MAP)
    .filter(([, roles]) => roles.includes(role))
    .map(([status]) => status);
}

export function getAllowedNextStatuses(
  role: string | null,
  current: string | null,
) {
  if (!role || !current) return [] as string[];
  if (!ALL_STATUS_SET.has(current)) return [] as string[];

  if (role === "ADMINISTRADOR") {
    return ALL_STATUSES.slice();
  }

  const allowedByRole = new Set(getAllowedStatusesForRole(role));
  const next = STATUS_TRANSITIONS[current] ?? [];

  return next.filter((status) => allowedByRole.has(status));
}

export function canRoleChangeStatus(
  role: string | null,
  current: string | null,
  next: string,
) {
  if (!role) return false;
  if (!ALL_STATUS_SET.has(next)) return false;

  if (role === "ADMINISTRADOR") return true;

  if (!current || !ALL_STATUS_SET.has(current)) return false;

  const allowed = getAllowedStatusesForRole(role);

  if (!allowed.includes(next)) return false;

  const allowedNext = STATUS_TRANSITIONS[current] ?? [];

  return allowedNext.includes(next) || next === current;
}

export function isOperarioRole(role: string | null) {
  if (!role) return false;

  return role.startsWith("OPERARIO_") || role === "EMPAQUE";
}
