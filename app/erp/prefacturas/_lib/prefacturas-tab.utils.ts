import { DISPATCH_BLOCKED_STATUSES } from "./prefacturas-tab.constants";

export function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) return "-";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function normalizeCurrency(
  value: string | null | undefined,
): "COP" | "USD" {
  return String(value ?? "COP").trim().toUpperCase() === "USD" ? "USD" : "COP";
}

export function formatMoneyByCurrency(
  value: string | number | null | undefined,
  currency: "COP" | "USD",
) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) return "-";

  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "USD" ? 2 : 0,
    maximumFractionDigits: currency === "USD" ? 2 : 0,
  }).format(amount);
}

export function normalizeAmountInput(value: string) {
  const raw = value.replace(/[^\d.,]/g, "");

  if (!raw) return "";

  const normalized = raw.replace(/,/g, ".");
  const parts = normalized.split(".");

  if (parts.length === 1) {
    return parts[0].replace(/^0+(?=\d)/, "");
  }

  const integer = (parts[0] || "0").replace(/^0+(?=\d)/, "");
  const decimal = parts.slice(1).join("").replace(/\D/g, "").slice(0, 2);

  return decimal ? `${integer}.${decimal}` : integer;
}

export function resolveAdvanceStatus(amount: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return "PENDIENTE";

  const percentage = Math.max(0, (amount / total) * 100);

  if (percentage >= 50) return "RECIBIDO";
  if (percentage > 29) return "PARCIAL";

  return "PENDIENTE";
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("es-CO");
}

export function canShowReadyDispatchAction(
  currentStatusRaw: string | null | undefined,
) {
  const currentStatus = String(currentStatusRaw ?? "").trim().toUpperCase();

  return !(DISPATCH_BLOCKED_STATUSES as readonly string[]).includes(
    currentStatus,
  );
}

export function resolveTargetStatus(
  currentStatusRaw: string,
  paidPercent: number,
): { targetStatus: "APROBACION" | "PROGRAMACION" | null; reason: string } {
  const currentStatus = String(currentStatusRaw ?? "").trim().toUpperCase();
  const isPaidAtLeast50 = paidPercent >= 50;

  if ((DISPATCH_BLOCKED_STATUSES as readonly string[]).includes(currentStatus)) {
    return {
      targetStatus: null,
      reason: `The order is already in ${currentStatus} and does not require this manual shipment.`,
    };
  }

  if (isPaidAtLeast50) {
    if (currentStatus === "APROBACION") {
      return {
        targetStatus: "PROGRAMACION",
        reason:
          "The confirmed advance is 50% or more, it will be sent to Scheduling.",
      };
    }

    return {
      targetStatus: "APROBACION",
      reason:
        "Although the advance is 50% or more, the workflow requires passing through Approval before Scheduling.",
    };
  }

  if (currentStatus === "APROBACION") {
    return {
      targetStatus: null,
      reason:
        "The order is already in Approval. When it meets the rules, you can send it to Scheduling.",
    };
  }

  return {
    targetStatus: "APROBACION",
    reason:
      "With confirmed advance less than 50%, the order should be sent to Approval.",
  };
}
