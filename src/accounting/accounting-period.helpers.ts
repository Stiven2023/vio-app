export function formatAccountingPeriodFromDate(isoDate: string) {
  const normalized = String(isoDate ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("La fecha debe usar formato YYYY-MM-DD.");
  }

  return normalized.slice(0, 7);
}