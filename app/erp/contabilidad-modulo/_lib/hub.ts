export type AccountingLocale = "en" | "es";

export type AccountingPermissionKey =
  | "VER_PEDIDO"
  | "VER_RECIBO_CAJA"
  | "VER_CONCILIACION_BANCARIA"
  | "VER_RETENCIONES"
  | "VER_FACTORING"
  | "VER_CARTERA"
  | "VER_ESTADO_RESULTADOS"
  | "VER_CAJA_MENOR";

export type AccountingAccessMap = Record<string, boolean>;

export type AccountingHubLink = {
  title: string;
  href: string;
  description: string;
};

export type AccountingHubGroup = {
  key: string;
  title: string;
  description: string;
  items: AccountingHubLink[];
};

type LocalizedText = Record<AccountingLocale, string>;

type AccountingHubItemDefinition = {
  title: LocalizedText;
  href: string;
  description: LocalizedText;
  permission: AccountingPermissionKey;
};

type AccountingHubGroupDefinition = {
  key: string;
  title: LocalizedText;
  description: LocalizedText;
  items: AccountingHubItemDefinition[];
};

export const ACCOUNTING_HUB_COPY: Record<
  AccountingLocale,
  {
    pageTitle: string;
    pageDescription: string;
    loading: string;
    navigationAriaLabel: string;
    downloadQaFormat: string;
  }
> = {
  en: {
    pageTitle: "Accounting",
    pageDescription:
      "Grouped operational access to execute the full accounting cycle.",
    loading: "Loading...",
    navigationAriaLabel: "Accounting navigation",
    downloadQaFormat: "Download QA format (CSV)",
  },
  es: {
    pageTitle: "Contabilidad",
    pageDescription:
      "Accesos agrupados por bloque operativo para ejecutar el ciclo contable completo.",
    loading: "Cargando...",
    navigationAriaLabel: "Navegacion contable",
    downloadQaFormat: "Descargar formato de prueba (CSV)",
  },
};

const ACCOUNTING_HUB_DEFINITIONS: AccountingHubGroupDefinition[] = [
  {
    key: "documents",
    title: {
      en: "Commercial documents",
      es: "Documentos comerciales",
    },
    description: {
      en: "Sales document issuance and control.",
      es: "Emision y control documental de ventas.",
    },
    items: [
      {
        title: { en: "Invoices", es: "Facturas" },
        href: "/erp/contabilidad-modulo/facturas",
        description: {
          en: "Final invoicing management.",
          es: "Gestion de facturacion final.",
        },
        permission: "VER_PEDIDO",
      },
      {
        title: { en: "Remissions", es: "Remisiones" },
        href: "/erp/contabilidad-modulo/remisiones",
        description: {
          en: "Dispatch and support control.",
          es: "Control de despachos y soportes.",
        },
        permission: "VER_PEDIDO",
      },
      {
        title: { en: "Withholdings", es: "Retenciones" },
        href: "/erp/contabilidad-modulo/retenciones",
        description: {
          en: "Income tax, ICA and VAT withholdings.",
          es: "Retefuente, reteICA y reteIVA.",
        },
        permission: "VER_RETENCIONES",
      },
    ],
  },
  {
    key: "cash-and-banks",
    title: {
      en: "Collections and banks",
      es: "Recaudo y bancos",
    },
    description: {
      en: "Payment intake and bank statement control.",
      es: "Ingreso de pagos y control de extractos.",
    },
    items: [
      {
        title: { en: "Cash receipt", es: "Recibo de caja" },
        href: "/erp/contabilidad-modulo/recibo-caja",
        description: {
          en: "Collection application per client.",
          es: "Aplicacion de recaudos por cliente.",
        },
        permission: "VER_RECIBO_CAJA",
      },
      {
        title: { en: "Deposits", es: "Consignaciones" },
        href: "/erp/depositos",
        description: {
          en: "Deposits, allocations and accounting macro view.",
          es: "Depositos, abonos y macro contable.",
        },
        permission: "VER_PEDIDO",
      },
      {
        title: { en: "Bank statements", es: "Extractos bancarios" },
        href: "/erp/contabilidad-modulo/extractos-bancarios",
        description: {
          en: "Base data for reconciliation by period.",
          es: "Base para conciliacion por periodo.",
        },
        permission: "VER_CONCILIACION_BANCARIA",
      },
    ],
  },
  {
    key: "receivables",
    title: {
      en: "Receivables and recovery",
      es: "Cartera y recuperacion",
    },
    description: {
      en: "Accounts receivable follow-up.",
      es: "Seguimiento de cuentas por cobrar.",
    },
    items: [
      {
        title: { en: "Receivables", es: "Cartera" },
        href: "/erp/contabilidad-modulo/cartera",
        description: {
          en: "Receivables by client and due dates.",
          es: "Cartera por cliente y vencimientos.",
        },
        permission: "VER_CARTERA",
      },
      {
        title: { en: "Factoring", es: "Factorizacion" },
        href: "/erp/contabilidad-modulo/factoring",
        description: {
          en: "Assigned receivables control.",
          es: "Control de cesion de cartera.",
        },
        permission: "VER_FACTORING",
      },
    ],
  },
  {
    key: "close-and-control",
    title: {
      en: "Closing and control",
      es: "Cierre y control",
    },
    description: {
      en: "Results overview and operating expenses.",
      es: "Vision de resultados y gastos operativos.",
    },
    items: [
      {
        title: { en: "Petty cash", es: "Caja menor" },
        href: "/erp/contabilidad-modulo/caja-menor",
        description: {
          en: "Funds and minor transaction control.",
          es: "Fondos y movimientos menores.",
        },
        permission: "VER_CAJA_MENOR",
      },
      {
        title: { en: "Income statement", es: "Estado de resultados" },
        href: "/erp/contabilidad-modulo/estado-resultados",
        description: {
          en: "Profit and loss by period.",
          es: "Perdidas y ganancias por periodo.",
        },
        permission: "VER_ESTADO_RESULTADOS",
      },
    ],
  },
];

export function resolveAccountingLocale(value?: string | null): AccountingLocale {
  const normalized = String(value ?? "en").trim().toLowerCase();

  return normalized.startsWith("es") ? "es" : "en";
}

export function buildAccountingHubGroups(
  locale: AccountingLocale,
  accessMap: AccountingAccessMap,
): AccountingHubGroup[] {
  return ACCOUNTING_HUB_DEFINITIONS.map((group) => ({
    key: group.key,
    title: group.title[locale],
    description: group.description[locale],
    items: group.items
      .filter((item) => Boolean(accessMap[item.permission]))
      .map((item) => ({
        title: item.title[locale],
        href: item.href,
        description: item.description[locale],
      })),
  })).filter((group) => group.items.length > 0);
}

export function hasAccountingHubAccess(accessMap: AccountingAccessMap): boolean {
  return ACCOUNTING_HUB_DEFINITIONS.some((group) =>
    group.items.some((item) => Boolean(accessMap[item.permission])),
  );
}