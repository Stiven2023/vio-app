import { ORDER_STATUS, type OrderStatus } from "@/src/utils/order-status";

export const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);

export type WorkflowOrderStatus = OrderStatus;

const ORDER_STATUS_SET = new Set<string>(ORDER_STATUS_VALUES);

const ORDER_STATUS_TRANSITIONS: Record<WorkflowOrderStatus, WorkflowOrderStatus[]> = {
  PENDIENTE: [ORDER_STATUS.APROBACION, ORDER_STATUS.CANCELADO],
  APROBACION: [ORDER_STATUS.PROGRAMACION, ORDER_STATUS.CANCELADO],
  PROGRAMACION: [ORDER_STATUS.PRODUCCION, ORDER_STATUS.APROBACION, ORDER_STATUS.ATRASADO, ORDER_STATUS.CANCELADO],
  PRODUCCION: [ORDER_STATUS.ATRASADO, ORDER_STATUS.FINALIZADO, ORDER_STATUS.CANCELADO],
  ATRASADO: [ORDER_STATUS.PRODUCCION, ORDER_STATUS.FINALIZADO, ORDER_STATUS.CANCELADO],
  FINALIZADO: [ORDER_STATUS.ENTREGADO],
  ENTREGADO: [],
  CANCELADO: [],
};

export function isOrderStatus(value: unknown): value is WorkflowOrderStatus {
  return ORDER_STATUS_SET.has(String(value ?? "").trim().toUpperCase());
}

export function getAllowedNextOrderStatuses(current: string | null | undefined) {
  const normalized = String(current ?? "").trim().toUpperCase();

  if (!isOrderStatus(normalized)) return [] as WorkflowOrderStatus[];

  return ORDER_STATUS_TRANSITIONS[normalized];
}

export function canTransitionOrderStatus(
  current: string | null | undefined,
  next: string | null | undefined,
) {
  const currentNormalized = String(current ?? "").trim().toUpperCase();
  const nextNormalized = String(next ?? "").trim().toUpperCase();

  if (!isOrderStatus(nextNormalized)) return false;
  if (!isOrderStatus(currentNormalized)) return false;
  if (currentNormalized === nextNormalized) return true;

  return ORDER_STATUS_TRANSITIONS[currentNormalized].includes(nextNormalized);
}

export function calculateOrderPaymentPercent(args: {
  total: unknown;
  shippingFee?: unknown;
  paidTotal: unknown;
}) {
  const total = Number(args.total ?? 0);
  const shippingFee = Number(args.shippingFee ?? 0);
  const paidTotal = Number(args.paidTotal ?? 0);
  const denominator = Math.max(0, total) + Math.max(0, shippingFee);

  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  if (!Number.isFinite(paidTotal) || paidTotal <= 0) return 0;

  return Math.max(0, (paidTotal / denominator) * 100);
}

export function requiresApprovalBeforeProgramming(paymentPercent: number) {
  return paymentPercent < 50;
}
