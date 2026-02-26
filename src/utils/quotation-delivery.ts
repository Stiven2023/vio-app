const PROCESS_LEAD_DAYS: Record<string, number> = {
  BODEGA: 5,
  COMPRAS: 15,
  PRODUCCION: 28,
};

export const DEFAULT_LEAD_DAYS = 7;
export const ADDITIONS_EXTRA_DAYS = 0;

function normalizeOrderType(value: unknown) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "BODEGA") return "REPOSICION";
  return raw;
}

function normalizeProcess(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function toPositiveInt(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function toDateOnlyLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getItemLeadDays(item: {
  orderType?: unknown;
  process?: unknown;
  negotiation?: unknown;
  additions?: Array<unknown> | null;
}) {
  const orderType = normalizeOrderType(item?.orderType);
  const process = normalizeProcess(item?.process ?? item?.negotiation);

  let baseDays = DEFAULT_LEAD_DAYS;

  if (orderType === "REPOSICION") {
    baseDays = 6;
  } else if (orderType === "MUESTRA" && process === "PRODUCCION") {
    baseDays = 6;
  } else if (process === "BODEGA") {
    baseDays = PROCESS_LEAD_DAYS.BODEGA;
  } else if (process === "COMPRAS") {
    baseDays = PROCESS_LEAD_DAYS.COMPRAS;
  } else if (
    orderType === "NORMAL" ||
    orderType === "COMPLETACION" ||
    orderType === "REFERENTE" ||
    orderType === "OBSEQUIO"
  ) {
    baseDays = PROCESS_LEAD_DAYS.PRODUCCION;
  }

  const additionsCount = Array.isArray(item?.additions) ? item.additions.length : 0;
  const additionsDays = additionsCount > 0 ? ADDITIONS_EXTRA_DAYS : 0;

  return Math.max(1, toPositiveInt(baseDays + additionsDays));
}

export function getMaxLeadDays(
  items: Array<{
    orderType?: unknown;
    process?: unknown;
    negotiation?: unknown;
    additions?: Array<unknown> | null;
  }>,
) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  return items.reduce((max, item) => Math.max(max, getItemLeadDays(item)), 0);
}

export function buildDeliveryDateFromItems(
  items: Array<{
    orderType?: unknown;
    process?: unknown;
    negotiation?: unknown;
    additions?: Array<unknown> | null;
  }>,
  fromDate = new Date(),
) {
  const maxLeadDays = getMaxLeadDays(items);
  if (maxLeadDays <= 0) return null;

  const d = new Date(fromDate);
  d.setDate(d.getDate() + maxLeadDays);
  return toDateOnlyLocal(d);
}

export function buildExpiryDateFromDelivery(deliveryDate: string | null, extraDays = 30) {
  if (!deliveryDate) return null;
  const [year, month, day] = String(deliveryDate).split("-").map(Number);
  if (!year || !month || !day) return null;

  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + Math.max(0, toPositiveInt(extraDays)));
  return toDateOnlyLocal(d);
}
