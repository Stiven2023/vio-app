export const HR_PROVISIONES_NOMINA_PERMISSIONS = [
  "VER_PROVISIONES_NOMINA",
  "CREAR_PROVISIONES_NOMINA",
];

export function getProvisionesNominaPageCopy() {
  return {
    title: "RH | Provisiones de Nómina",
    description:
      "Gestión de provisiones laborales: cesantías, intereses, prima, vacaciones y seguridad social.",
  };
}

export function getProvisionesNominaRedirectPath() {
  return "/hr/provisiones-nomina";
}
