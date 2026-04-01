export const DOCUMENT_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "F", label: "F" },
  { value: "R", label: "R" },
] as const;

export const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "PENDIENTE_CONTABILIDAD", label: "Pending accounting" },
  { value: "APROBADO_CONTABILIDAD", label: "Accounting approved" },
  { value: "APROBACION", label: "Approval" },
  { value: "PROGRAMACION", label: "Scheduling" },
  { value: "PENDIENTE", label: "Pending" },
  { value: "APROBADA", label: "Approved" },
  { value: "CANCELADA", label: "Cancelled" },
  { value: "ANULADA", label: "Voided" },
] as const;

export const TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "VN", label: "National" },
  { value: "VI", label: "International" },
  { value: "VT", label: "VT" },
  { value: "VW", label: "VW" },
] as const;

/** Order statuses that block the "ready for dispatch" action */
export const DISPATCH_BLOCKED_STATUSES = [
  "PROGRAMACION",
  "PRODUCCION",
  "ATRASADO",
  "FINALIZADO",
  "ENTREGADO",
  "CANCELADO",
] as const;

/** Prefactura statuses that allow the accounting approve-advance action */
export const APPROVE_ADVANCE_ALLOWED_STATUSES = [
  "PENDIENTE_CONTABILIDAD",
  "PENDIENTE",
  "APROBACION",
] as const;

/** SIIGO statuses considered "blocked" for further edits */
export const SIIGO_BLOCKED_STATUSES = ["SENT", "INVOICED", "ACCEPTED"] as const;
