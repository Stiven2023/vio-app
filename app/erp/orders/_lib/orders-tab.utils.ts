import type {
  OrderHistoryItem,
  OrderListItem,
  OrderStatus,
  UiLocale,
} from "./types";

import {
  COMMERCIAL_DECISION_ALLOWED_STATUSES,
  READY_DISPATCH_BLOCKED_STATUSES,
} from "./orders-tab.constants";

export type DispatchTargetStatus = "APROBACION" | "PROGRAMACION" | null;

export type DispatchTargetResolution = {
  targetStatus: DispatchTargetStatus;
  reason: string;
};

function normalizeStatus(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export function getClientUiLocale(): UiLocale {
  const fromStorage =
    typeof window !== "undefined"
      ? window.localStorage.getItem("preferredLanguage")
      : null;
  const fromCookie =
    typeof document !== "undefined"
      ? (document.cookie
          .split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith("NEXT_LOCALE="))
          ?.split("=")[1] ?? null)
      : null;
  const fromHtml =
    typeof document !== "undefined" ? document.documentElement.lang : null;
  const value = String(fromStorage || fromCookie || fromHtml || "en")
    .trim()
    .toLowerCase();

  return value.startsWith("es") ? "es" : "en";
}

export function canRequestReadyDispatch(
  currentStatusRaw: string | null | undefined,
) {
  const currentStatus = normalizeStatus(currentStatusRaw);

  return !READY_DISPATCH_BLOCKED_STATUSES.includes(
    currentStatus as OrderStatus,
  );
}

export function canTakeCommercialDecision(
  currentStatusRaw: string | null | undefined,
) {
  const currentStatus = normalizeStatus(currentStatusRaw);

  return COMMERCIAL_DECISION_ALLOWED_STATUSES.includes(
    currentStatus as OrderStatus,
  );
}

export function formatOrderCurrency(
  value: string | number | null | undefined,
  currency: string | null | undefined,
) {
  const amount = Number(value ?? 0);
  const code =
    String(currency ?? "COP").toUpperCase() === "USD" ? "USD" : "COP";

  if (!Number.isFinite(amount)) return code === "USD" ? "$0.00" : "$0";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatOrderDate(value: string | null | undefined) {
  const raw = String(value ?? "").trim();

  if (!raw) return "-";

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString("es-CO");
}

export function formatOrderLastUpdate(item: OrderHistoryItem) {
  if (!item.createdAt) return "-";

  const date = new Date(item.createdAt);

  return Number.isNaN(date.getTime())
    ? item.createdAt
    : date.toLocaleString("es-CO");
}

export function calculatePaidPercent(
  order: Pick<OrderListItem, "total" | "shippingFee" | "paidTotal">,
) {
  const total = Number(order.total ?? 0);
  const shipping = Number(order.shippingFee ?? 0);
  const denominator = total + shipping;
  const paid = Number(order.paidTotal ?? 0);

  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  if (!Number.isFinite(paid) || paid <= 0) return 0;

  return Math.min(100, Math.max(0, (paid / denominator) * 100));
}

export function resolveDispatchTarget(
  order: Pick<OrderListItem, "status">,
  paidPercent: number,
  locale: UiLocale = "en",
): DispatchTargetResolution {
  const currentStatus = normalizeStatus(order.status);
  const isPaidAtLeast50 = paidPercent >= 50;
  const copy =
    locale === "es"
      ? {
          alreadyInStatus: `El pedido ya esta en ${currentStatus} y no requiere este despacho manual.`,
          approvedAndPaid:
            "Contabilidad ya aprobo el anticipo y el pago es de al menos 50%; debe enviarse a Programacion.",
          approvalAndPaid:
            "El anticipo confirmado es de 50% o mas; se enviara a Programacion.",
          requiresApproval:
            "Aunque el anticipo es de 50% o mas, el flujo exige pasar por Aprobacion antes de Programacion.",
          accountingPending:
            "La aprobacion de contabilidad sigue pendiente, asi que esta accion solo envia el pedido a Aprobacion.",
          alreadyApproval:
            "El pedido ya esta en Aprobacion. Cuando cumpla las reglas podras enviarlo a Programacion.",
          belowFifty:
            "Con anticipo confirmado menor al 50%, el pedido debe enviarse a Aprobacion.",
        }
      : {
          alreadyInStatus: `The order is already in ${currentStatus} and does not require this manual dispatch.`,
          approvedAndPaid:
            "Accounting already approved the advance and payment is at least 50%; it should be sent to Scheduling.",
          approvalAndPaid:
            "Confirmed advance is 50% or more; it will be sent to Scheduling.",
          requiresApproval:
            "Although the advance is 50% or more, workflow requires passing through Approval before Scheduling.",
          accountingPending:
            "Accounting approval is still pending, so this action only sends the order to Approval.",
          alreadyApproval:
            "The order is already in Approval. When it meets the rules you can send it to Scheduling.",
          belowFifty:
            "With confirmed advance below 50%, the order should be sent to Approval.",
        };

  if (READY_DISPATCH_BLOCKED_STATUSES.includes(currentStatus as OrderStatus)) {
    return {
      targetStatus: null,
      reason: copy.alreadyInStatus,
    };
  }

  if (isPaidAtLeast50) {
    if (currentStatus === "APROBADO_CONTABILIDAD") {
      return {
        targetStatus: "PROGRAMACION",
        reason: copy.approvedAndPaid,
      };
    }

    if (currentStatus === "APROBACION") {
      return {
        targetStatus: "PROGRAMACION",
        reason: copy.approvalAndPaid,
      };
    }

    return {
      targetStatus: "APROBACION",
      reason: copy.requiresApproval,
    };
  }

  if (currentStatus === "PENDIENTE_CONTABILIDAD") {
    return {
      targetStatus: "APROBACION",
      reason: copy.accountingPending,
    };
  }

  if (currentStatus === "APROBACION") {
    return {
      targetStatus: null,
      reason: copy.alreadyApproval,
    };
  }

  return {
    targetStatus: "APROBACION",
    reason: copy.belowFifty,
  };
}
