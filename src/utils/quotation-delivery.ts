export const NEGOTIATION_LEAD_DAYS: Record<string, number> = {
  BODEGA: 1,
  MUESTRA: 28,
  COMPRAS: 15,
  PRODUCCION: 28,
  CONVENIO: 28,
  OBSEQUIO: 28,
};

export const DEFAULT_LEAD_DAYS = 7;
export const ADDITIONS_EXTRA_DAYS = 0;

function normalizeNegotiation(value: unknown) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (raw === "MUESTRA_G" || raw === "MUESTRA_C") return "MUESTRA";
  return raw;
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
  negotiation?: unknown;
  additions?: Array<unknown> | null;
}) {
  const negotiation = normalizeNegotiation(item?.negotiation);
  const baseDays = NEGOTIATION_LEAD_DAYS[negotiation] ?? DEFAULT_LEAD_DAYS;
  const additionsCount = Array.isArray(item?.additions) ? item.additions.length : 0;
  const additionsDays = additionsCount > 0 ? ADDITIONS_EXTRA_DAYS : 0;

  return Math.max(1, toPositiveInt(baseDays + additionsDays));
}

export function getMaxLeadDays(
  items: Array<{ negotiation?: unknown; additions?: Array<unknown> | null }>,
) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  return items.reduce((max, item) => Math.max(max, getItemLeadDays(item)), 0);
}

export function buildDeliveryDateFromItems(
  items: Array<{ negotiation?: unknown; additions?: Array<unknown> | null }>,
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
