const ORDER_STATUS_REASON_LABELS_ES: Record<string, string> = {
  ACCOUNTING_APPROVED_ADVANCE: "Anticipo aprobado por contabilidad",
  AUTO_SCHEDULE_AFTER_ACCOUNTING:
    "Autoavance a programacion despues de aprobacion contable",
  ADVISOR_REQUEST_SCHEDULING: "Solicitud de programacion por asesor",
  ADVISOR_REQUEST_APPROVAL: "Solicitud de aprobacion por asesor",
  COMMERCIAL_APPROVED: "Aprobacion comercial registrada",
  COMMERCIAL_WAITING_PAYMENT: "Comercial marco espera de abono",
};

const ORDER_STATUS_REASON_LABELS_EN: Record<string, string> = {
  ACCOUNTING_APPROVED_ADVANCE: "Advance approved by accounting",
  AUTO_SCHEDULE_AFTER_ACCOUNTING:
    "Auto-scheduled after accounting approval",
  ADVISOR_REQUEST_SCHEDULING: "Scheduling requested by advisor",
  ADVISOR_REQUEST_APPROVAL: "Approval requested by advisor",
  COMMERCIAL_APPROVED: "Commercial approval recorded",
  COMMERCIAL_WAITING_PAYMENT: "Commercial marked waiting for payment",
};

export function formatOrderStatusReason(
  reasonCode: string | null | undefined,
  locale: string | null | undefined = "en",
) {
  const code = String(reasonCode ?? "")
    .trim()
    .toUpperCase();
  const normalizedLocale = String(locale ?? "en")
    .trim()
    .toLowerCase();

  if (!code) return "-";

  const dict = normalizedLocale.startsWith("es")
    ? ORDER_STATUS_REASON_LABELS_ES
    : ORDER_STATUS_REASON_LABELS_EN;

  return dict[code] ?? code.replace(/_/g, " ");
}
