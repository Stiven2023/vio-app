export const PAYMENT_STATUS_VALUES = [
  "PENDIENTE",
  "PARCIAL",
  "PAGADO",
  "ANULADO",
  "CONFIRMADO_CAJA",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDIENTE: "NO CONSIGNADO",
  PARCIAL: "CONSIGNADO",
  PAGADO: "APROBADO",
  ANULADO: "ANULADO",
  CONFIRMADO_CAJA: "RECIBIDO EN CAJA",
};

export function isConfirmedPaymentStatus(status: unknown) {
  const s = String(status ?? "").trim().toUpperCase();
  return s === "PAGADO" || s === "CONFIRMADO_CAJA";
}

export function canSetPaymentStatusOnApproval(status: unknown) {
  const normalized = String(status ?? "").trim().toUpperCase();
  return normalized === "PAGADO" || normalized === "ANULADO";
}

export function normalizePaymentStatusLabel(status: unknown) {
  const normalized = String(status ?? "").trim().toUpperCase() as PaymentStatus;
  return PAYMENT_STATUS_LABELS[normalized] ?? normalized ?? "-";
}
