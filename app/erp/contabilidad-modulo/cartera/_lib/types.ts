export type AccountsReceivableLocale = "en" | "es";

export type PaymentType = "CASH" | "CREDIT";
export type AgingBucket = "CURRENT" | "1_30" | "31_60" | "61_90" | "90_PLUS";
export type CreditBackingType =
  | "PROMISSORY_NOTE"
  | "PURCHASE_ORDER"
  | "VERBAL_AGREEMENT";

export type ClientOption = {
  id: string;
  name: string;
};

export type AccountsReceivableRow = {
  id: string;
  prefacturaCode: string;
  approvedAt: string | null;
  dueDate: string | null;
  paymentType: string;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  clientId: string | null;
  clientName: string | null;
  creditBackingType: CreditBackingType | null;
  daysOverdue: number | null;
  agingBucket: AgingBucket | null;
};

export type AccountsReceivableData = {
  items: AccountsReceivableRow[];
  clients: ClientOption[];
  summary: {
    current: string;
    d1_30: string;
    d31_60: string;
    d61_90: string;
    d90plus: string;
    grandTotal: string;
  } | null;
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};