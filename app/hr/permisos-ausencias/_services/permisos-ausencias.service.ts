export const HR_PERMISOS_AUSENCIAS_PERMISSIONS = [
  "VER_PERMISOS_EMPLEADO",
  "APROBAR_PERMISO_EMPLEADO",
];

export function getPermisosAusenciasPageCopy() {
  return {
    title: "RH | Permisos y Ausencias",
    description:
      "Registro y seguimiento de ausencias del personal, con impacto de nómina y control mensual.",
  };
}

export function getPermisosAusenciasRedirectPath() {
  return "/hr/permisos-ausencias";
}
