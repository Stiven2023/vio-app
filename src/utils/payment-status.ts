export const PAYMENT_STATUS_VALUES = [
  "PENDIENTE",
  "PARCIAL",
  "PAGADO",
  "ANULADO",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDIENTE: "NO CONSIGNADO",
  PARCIAL: "CONSIGNADO",
  PAGADO: "CONSIGNADO",
  ANULADO: "ANULADO",
};

export function isConfirmedPaymentStatus(status: unknown) {
  return String(status ?? "").trim().toUpperCase() === "PAGADO";
}

export function canSetPaymentStatusOnApproval(status: unknown) {
  const normalized = String(status ?? "").trim().toUpperCase();
  return normalized === "PAGADO" || normalized === "ANULADO";
}

export function normalizePaymentStatusLabel(status: unknown) {
  const normalized = String(status ?? "").trim().toUpperCase() as PaymentStatus;
  return PAYMENT_STATUS_LABELS[normalized] ?? normalized ?? "-";
}
