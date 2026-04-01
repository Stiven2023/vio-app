export function parseRatePercentage(value: unknown): string | null {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 100) return null;

  return parsed.toFixed(4);
}

export function isPermissionHoursValid(hours: number): boolean {
  return Number.isFinite(hours) && hours >= 0.5 && hours <= 24;
}

export function normalizePermissionHours(
  type: string,
  requestHoursRaw: unknown,
): string | null {
  const requestHours =
    requestHoursRaw !== undefined &&
    requestHoursRaw !== null &&
    requestHoursRaw !== ""
      ? Number(requestHoursRaw)
      : null;

  if (type !== "PERMISO" || requestHours === null) return null;
  if (!isPermissionHoursValid(requestHours)) return null;

  return requestHours.toFixed(2);
}

export function hasDuplicateOrderAllocations(
  allocations: Array<{ orderId: string }>,
): boolean {
  const ids = allocations.map((a) => a.orderId);

  return new Set(ids).size !== ids.length;
}

export function isClientEligibleForQuotation(
  client:
    | {
        id: string;
        isActive: boolean | null;
      }
    | null
    | undefined,
): boolean {
  return Boolean(client?.id && client.isActive);
}

export function hasDateRangeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA <= endB && endA >= startB;
}
