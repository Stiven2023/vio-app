export type OrderType = "VN" | "VI" | "VT" | "VW";

export type PrefacturaRow = {
  id: string;
  prefacturaCode: string;
  quotationId: string | null;
  quoteCode: string | null;
  orderId: string | null;
  orderCode: string | null;
  orderName: string | null;
  orderType: OrderType | null;
  status: string;
  totalProducts: string | null;
  subtotal: string | null;
  total: string | null;
  clientName: string | null;
  documentType: "F" | "R" | null;
  approvedAt: string | null;
  createdAt: string | null;
  siigoStatus: string | null;
  siigoInvoiceId: string | null;
  siigoInvoiceNumber: string | null;
  siigoErrorMessage: string | null;
};

export type BankOption = {
  id: string;
  code: string;
  name: string;
  accountRef: string;
  isActive: boolean | null;
};

export type PrefacturaAdvanceDetail = {
  id: string;
  prefacturaCode?: string | null;
  total?: string | null;
  currency?: string | null;
  advanceRequired?: string | null;
  advanceReceived?: string | null;
  advanceMethod?: "EFECTIVO" | "TRANSFERENCIA" | null;
  advanceBankId?: string | null;
  advanceReferenceNumber?: string | null;
  advanceCurrency?: string | null;
  advanceDate?: string | null;
  advancePaymentImageUrl?: string | null;
};

export type OrderDispatchPreview = {
  id: string;
  orderCode: string;
  status: string;
  total: string | null;
  shippingFee?: string | null;
};

export type ReadyDispatchPreview = {
  prefacturaCode: string;
  orderId: string;
  orderCode: string;
  currentStatus: string;
  targetStatus: "APROBACION" | "PROGRAMACION" | null;
  reason: string;
  paidPercent: number;
  paidTotal: number;
  orderTotal: number;
};

export type ApproveAdvanceResult = {
  ok: boolean;
  prefacturaId: string;
  orderId: string | null;
  accountingApproved: boolean;
  fromOrderStatus: string;
  toOrderStatus: string | null;
  paidPercent: number;
  autoScheduled: boolean;
  message: string;
};

export type RequestSchedulingResult = {
  changed: boolean;
  fromStatus: string;
  toStatus: "APROBACION" | "PROGRAMACION" | null;
  reason: string;
};

export type SiigoErrorModal = {
  prefacturaCode: string;
  message: string;
};

export type SiigoAuthStatus = {
  liveSubmissionEnabled: boolean;
};
