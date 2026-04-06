import { makeDeterministicUuid, normalizeOrderCode } from "@/src/imports/historical-excel/helpers";

export const linkedImportValidPrefixes = ["VN", "VT", "VI", "VW", "VR", "VP"] as const;

export function hasValidLinkedImportPrefix(orderCode: string) {
  const normalized = normalizeOrderCode(orderCode);
  const prefix = normalized.split(" - ")[0]?.trim().toUpperCase() ?? "";

  return linkedImportValidPrefixes.includes(
    prefix as (typeof linkedImportValidPrefixes)[number],
  );
}

export function mapLinkedImportOrderType(orderCode: string) {
  const normalized = normalizeOrderCode(orderCode);
  const prefix = normalized.split(" - ")[0]?.trim().toUpperCase() ?? "VN";

  if (prefix === "VR" || prefix === "VP") {
    return "VN" as const;
  }

  if (
    linkedImportValidPrefixes.includes(
      prefix as (typeof linkedImportValidPrefixes)[number],
    )
  ) {
    return prefix as "VN" | "VT" | "VI" | "VW";
  }

  return "VN" as const;
}

export function buildLinkedImportOrderId(orderCode: string) {
  return makeDeterministicUuid("historical-linked-order", normalizeOrderCode(orderCode));
}

export function buildLinkedImportOrderItemId(
  orderCode: string,
  designNumber: number,
) {
  return makeDeterministicUuid(
    "historical-linked-order-item",
    `${normalizeOrderCode(orderCode)}|${designNumber}`,
  );
}

export function buildLinkedImportOrderItemName(designNumber: number) {
  return `DISEÑO ${designNumber} migrado`;
}

export function resolveLinkedImportOrderStatus(args: {
  trackingStatus?: string | null;
  hasVentas: boolean;
  hasEnvios: boolean;
  hasSeguimiento: boolean;
}) {
  const trackingStatus = String(args.trackingStatus ?? "").trim().toUpperCase();

  if (trackingStatus.includes("DESPACH")) {
    return "ENTREGADO" as const;
  }

  if (trackingStatus.includes("PRODU")) {
    return "PRODUCCION" as const;
  }

  if (trackingStatus.includes("AVAL")) {
    return "PRODUCCION" as const;
  }

  if (args.hasSeguimiento || args.hasEnvios || args.hasVentas) {
    return "PRODUCCION" as const;
  }

  return "PRODUCCION" as const;
}

export function shouldUpgradeImportedOrderToProduction(args: {
  currentStatus: string | null | undefined;
  clientId: string | null | undefined;
  orderName: string | null | undefined;
  hasImportSignals: boolean;
}) {
  const currentStatus = String(args.currentStatus ?? "").trim().toUpperCase();

  return (
    args.hasImportSignals &&
    currentStatus === "APROBACION" &&
    !String(args.clientId ?? "").trim() &&
    !String(args.orderName ?? "").trim()
  );
}