import type {
  AccountsReceivableLocale,
  AgingBucket,
  CreditBackingType,
  PaymentType,
} from "./types";

type SelectOption<T extends string> = {
  value: T;
  label: string;
};

const AGING_LABELS: Record<AccountsReceivableLocale, Record<AgingBucket, string>> = {
  en: {
    CURRENT: "Current",
    "1_30": "1-30 days",
    "31_60": "31-60 days",
    "61_90": "61-90 days",
    "90_PLUS": "90+ days",
  },
  es: {
    CURRENT: "Al dia",
    "1_30": "1-30 dias",
    "31_60": "31-60 dias",
    "61_90": "61-90 dias",
    "90_PLUS": "90+ dias",
  },
};

const CREDIT_BACKING_LABELS: Record<
  AccountsReceivableLocale,
  Record<CreditBackingType, string>
> = {
  en: {
    PROMISSORY_NOTE: "Promissory note",
    PURCHASE_ORDER: "Purchase order",
    VERBAL_AGREEMENT: "Verbal agreement",
  },
  es: {
    PROMISSORY_NOTE: "Pagare",
    PURCHASE_ORDER: "Orden de compra",
    VERBAL_AGREEMENT: "Acuerdo verbal",
  },
};

export const ACCOUNTS_RECEIVABLE_COPY: Record<
  AccountsReceivableLocale,
  {
    pageTitle: string;
    pageDescription: string;
    tabs: Record<PaymentType, string>;
    filters: {
      client: string;
      all: string;
      aging: string;
      backing: string;
      from: string;
      to: string;
      export: string;
      exporting: string;
    };
    summary: { current: string; d1_30: string; d31_60: string; d61_90: string; d90Plus: string; total: string };
    creditTable: {
      ariaLabel: string;
      client: string;
      preinvoice: string;
      invoiceDate: string;
      dueDate: string;
      total: string;
      paid: string;
      balance: string;
      daysOverdue: string;
      aging: string;
      backing: string;
      loading: string;
      empty: string;
      remainingDays: string;
      overdueDays: string;
    };
    cashTable: {
      ariaLabel: string;
      client: string;
      preinvoice: string;
      invoiceDate: string;
      total: string;
      paid: string;
      balance: string;
      loading: string;
      empty: string;
    };
    export: {
      creditSheet: string;
      cashSheet: string;
      creditFilePrefix: string;
      cashFilePrefix: string;
      headers: {
        client: string;
        preinvoice: string;
        invoiceDate: string;
        dueDate: string;
        total: string;
        paid: string;
        balance: string;
        daysOverdue: string;
        aging: string;
        backing: string;
      };
    };
  }
> = {
  en: {
    pageTitle: "Portfolio / Receivables",
    pageDescription:
      "Portfolio report by payment type with aging analysis for credit.",
    tabs: { CASH: "Cash", CREDIT: "Credit" },
    filters: {
      client: "Client",
      all: "All",
      aging: "Aging",
      backing: "Credit backing",
      from: "From",
      to: "To",
      export: "Export Excel",
      exporting: "Exporting...",
    },
    summary: {
      current: "Current",
      d1_30: "1-30 days",
      d31_60: "31-60 days",
      d61_90: "61-90 days",
      d90Plus: "90+ days",
      total: "Grand total",
    },
    creditTable: {
      ariaLabel: "Credit accounts receivable aging report",
      client: "Client",
      preinvoice: "Pre-invoice",
      invoiceDate: "Invoice date",
      dueDate: "Due date",
      total: "Total",
      paid: "Paid",
      balance: "Balance",
      daysOverdue: "Days overdue",
      aging: "Aging",
      backing: "Backing",
      loading: "Loading...",
      empty: "No credit pre-invoices",
      remainingDays: "days remaining",
      overdueDays: "days",
    },
    cashTable: {
      ariaLabel: "Cash accounts receivable",
      client: "Client",
      preinvoice: "Pre-invoice",
      invoiceDate: "Invoice date",
      total: "Total",
      paid: "Paid",
      balance: "Outstanding balance",
      loading: "Loading...",
      empty: "No cash pre-invoices",
    },
    export: {
      creditSheet: "Credit A/R",
      cashSheet: "Cash A/R",
      creditFilePrefix: "credit-ar",
      cashFilePrefix: "cash-ar",
      headers: {
        client: "Client",
        preinvoice: "Pre-invoice",
        invoiceDate: "Invoice date",
        dueDate: "Due date",
        total: "Total",
        paid: "Paid",
        balance: "Outstanding balance",
        daysOverdue: "Days overdue",
        aging: "Aging",
        backing: "Credit backing",
      },
    },
  },
  es: {
    pageTitle: "Cartera",
    pageDescription:
      "Reporte de cartera por tipo de pago con analisis de vencimientos para credito.",
    tabs: { CASH: "Contado", CREDIT: "Credito" },
    filters: {
      client: "Cliente",
      all: "Todos",
      aging: "Vencimiento",
      backing: "Respaldo de credito",
      from: "Desde",
      to: "Hasta",
      export: "Exportar Excel",
      exporting: "Exportando...",
    },
    summary: {
      current: "Al dia",
      d1_30: "1-30 dias",
      d31_60: "31-60 dias",
      d61_90: "61-90 dias",
      d90Plus: "90+ dias",
      total: "Total general",
    },
    creditTable: {
      ariaLabel: "Reporte de cartera a credito",
      client: "Cliente",
      preinvoice: "Prefactura",
      invoiceDate: "Fecha factura",
      dueDate: "Fecha vencimiento",
      total: "Total",
      paid: "Pagado",
      balance: "Saldo",
      daysOverdue: "Dias de mora",
      aging: "Vencimiento",
      backing: "Respaldo",
      loading: "Cargando...",
      empty: "Sin prefacturas a credito",
      remainingDays: "dias restantes",
      overdueDays: "dias",
    },
    cashTable: {
      ariaLabel: "Cartera de contado",
      client: "Cliente",
      preinvoice: "Prefactura",
      invoiceDate: "Fecha factura",
      total: "Total",
      paid: "Pagado",
      balance: "Saldo pendiente",
      loading: "Cargando...",
      empty: "Sin prefacturas de contado",
    },
    export: {
      creditSheet: "Cartera Credito",
      cashSheet: "Cartera Contado",
      creditFilePrefix: "cartera-credito",
      cashFilePrefix: "cartera-contado",
      headers: {
        client: "Cliente",
        preinvoice: "Prefactura",
        invoiceDate: "Fecha factura",
        dueDate: "Fecha vencimiento",
        total: "Total",
        paid: "Pagado",
        balance: "Saldo pendiente",
        daysOverdue: "Dias de mora",
        aging: "Vencimiento",
        backing: "Respaldo de credito",
      },
    },
  },
};

export function getAgingOptions(
  locale: AccountsReceivableLocale,
): SelectOption<"ALL" | AgingBucket>[] {
  return [
    { value: "ALL", label: ACCOUNTS_RECEIVABLE_COPY[locale].filters.all },
    { value: "CURRENT", label: AGING_LABELS[locale].CURRENT },
    { value: "1_30", label: AGING_LABELS[locale]["1_30"] },
    { value: "31_60", label: AGING_LABELS[locale]["31_60"] },
    { value: "61_90", label: AGING_LABELS[locale]["61_90"] },
    { value: "90_PLUS", label: AGING_LABELS[locale]["90_PLUS"] },
  ];
}

export function getCreditBackingOptions(
  locale: AccountsReceivableLocale,
): SelectOption<"ALL" | CreditBackingType>[] {
  return [
    { value: "ALL", label: ACCOUNTS_RECEIVABLE_COPY[locale].filters.all },
    {
      value: "PROMISSORY_NOTE",
      label: CREDIT_BACKING_LABELS[locale].PROMISSORY_NOTE,
    },
    {
      value: "PURCHASE_ORDER",
      label: CREDIT_BACKING_LABELS[locale].PURCHASE_ORDER,
    },
    {
      value: "VERBAL_AGREEMENT",
      label: CREDIT_BACKING_LABELS[locale].VERBAL_AGREEMENT,
    },
  ];
}

export function getAgingLabel(
  locale: AccountsReceivableLocale,
  bucket: AgingBucket,
): string {
  return AGING_LABELS[locale][bucket];
}

export function getCreditBackingLabel(
  locale: AccountsReceivableLocale,
  type: CreditBackingType,
): string {
  return CREDIT_BACKING_LABELS[locale][type];
}