export const CLIENT_TYPES = [
  { value: "NACIONAL", label: "Cliente Nacional (CN)" },
  { value: "EXTRANJERO", label: "Cliente Extranjero (CE)" },
  { value: "EMPLEADO", label: "Empleado (EM)" },
];

export const PERSON_TYPES = [
  { value: "NATURAL", label: "Persona Natural" },
  { value: "JURIDICA", label: "Persona Jurídica" },
];

export const IDENTIFICATION_TYPES = [
  { value: "CC", label: "Cédula de ciudadanía (CC)" },
  { value: "NIT", label: "NIT" },
  { value: "CE", label: "Cédula de extranjería (CE)" },
  { value: "PAS", label: "Pasaporte (PAS)" },
  { value: "EMPRESA_EXTERIOR", label: "Empresa del exterior" },
];

export const TAX_REGIMES = [
  { value: "REGIMEN_COMUN", label: "Régimen común" },
  { value: "REGIMEN_SIMPLIFICADO", label: "Régimen simplificado" },
  { value: "NO_RESPONSABLE", label: "No responsable" },
];

export const CLIENT_STATUSES = [
  { value: "ACTIVO", label: "Activo" },
  { value: "INACTIVO", label: "Inactivo" },
  { value: "SUSPENDIDO", label: "Suspendido" },
];

export const CLIENT_PRICE_TYPES = [
  {
    value: "AUTORIZADO",
    label: "Cliente autorizado (puede modificar precio)",
  },
  { value: "MAYORISTA", label: "Cliente mayorista" },
  { value: "VIOMAR", label: "Cliente Viomar" },
  { value: "COLANTA", label: "Cliente Colanta" },
];
