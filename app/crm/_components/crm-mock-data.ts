export type CrmPreviewRow = {
  id: string;
  company: string;
  stage: "LEAD" | "CONTACTADO" | "PROPUESTA" | "NEGOCIACION" | "CIERRE";
  level: string;
  owner: string;
  estimatedValue: string;
  nextAction: string;
};

export const CRM_PREVIEW_ROWS: CrmPreviewRow[] = [
  {
    id: "CRM-001",
    company: "Academia Norte FC",
    stage: "LEAD",
    level: "Nivel 1 · Prospecto nuevo",
    owner: "Natalia",
    estimatedValue: "$ 8.500.000",
    nextAction: "Validar datos básicos y asignar primer contacto",
  },
  {
    id: "CRM-002",
    company: "Colegio Boston Medellín",
    stage: "CONTACTADO",
    level: "Nivel 2 · Descubrimiento",
    owner: "Mauricio",
    estimatedValue: "$ 12.300.000",
    nextAction: "Confirmar cantidades y fecha objetivo del pedido",
  },
  {
    id: "CRM-003",
    company: "Liga Antioqueña Élite",
    stage: "PROPUESTA",
    level: "Nivel 3 · Oferta enviada",
    owner: "Laura",
    estimatedValue: "$ 18.900.000",
    nextAction: "Presentar propuesta con variantes de tela y tiempos",
  },
  {
    id: "CRM-004",
    company: "Club Deportivo Central",
    stage: "NEGOCIACION",
    level: "Nivel 4 · Negociación activa",
    owner: "Carlos",
    estimatedValue: "$ 24.700.000",
    nextAction: "Resolver descuento, anticipo y aprobación comercial",
  },
  {
    id: "CRM-005",
    company: "Fundación Talento Joven",
    stage: "CIERRE",
    level: "Nivel 5 · Listo para convertir",
    owner: "Sergio",
    estimatedValue: "$ 31.400.000",
    nextAction: "Convertir a cotización y abrir flujo comercial",
  },
];