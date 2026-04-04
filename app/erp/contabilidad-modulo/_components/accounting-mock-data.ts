export type AccountingPreviewRow = {
  id: string;
  caseName: string;
  level: string;
  area: string;
  amount: string;
  status: "BORRADOR" | "PENDIENTE" | "EN_REVISION" | "CONCILIANDO" | "LISTO";
  nextAction: string;
};

export const ACCOUNTING_PREVIEW_ROWS: AccountingPreviewRow[] = [
  {
    id: "ACC-001",
    caseName: "Recibo de caja inicial",
    level: "Nivel 1 · Captura",
    area: "Recaudo",
    amount: "$ 2.400.000",
    status: "BORRADOR",
    nextAction: "Validar cliente, prefactura y soporte de pago",
  },
  {
    id: "ACC-002",
    caseName: "Consignación por distribuir",
    level: "Nivel 2 · Pendiente de aplicación",
    area: "Depósitos",
    amount: "$ 6.850.000",
    status: "PENDIENTE",
    nextAction: "Asignar abonos a pedidos del mismo cliente",
  },
  {
    id: "ACC-003",
    caseName: "Conciliación de extracto",
    level: "Nivel 3 · Revisión bancaria",
    area: "Bancos",
    amount: "$ 14.120.000",
    status: "EN_REVISION",
    nextAction: "Cruzar movimientos y marcar diferencias pendientes",
  },
  {
    id: "ACC-004",
    caseName: "Cartera vencida priorizada",
    level: "Nivel 4 · Seguimiento crítico",
    area: "Cartera",
    amount: "$ 19.700.000",
    status: "CONCILIANDO",
    nextAction: "Escalar cliente vencido y confirmar promesa de pago",
  },
  {
    id: "ACC-005",
    caseName: "Factoring listo para cierre",
    level: "Nivel 5 · Cierre contable",
    area: "Factoring",
    amount: "$ 27.300.000",
    status: "LISTO",
    nextAction: "Registrar cierre y dejar soporte de cesión disponible",
  },
];