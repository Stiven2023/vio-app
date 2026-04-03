export const HR_PILA_PERMISSIONS = ["VER_PILA", "GENERAR_PILA"];

export function getPilaPageCopy() {
  return {
    title: "RH | Seguridad Social (PILA)",
    description:
      "Liquidación de aportes de seguridad social por período con base en provisiones de nómina.",
  };
}

export function getPilaRedirectPath() {
  return "/hr/pila";
}
