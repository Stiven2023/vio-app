export function parsePagination(searchParams: URLSearchParams) {
  const pageRaw = searchParams.get("page") ?? "1";
  const pageSizeRaw = searchParams.get("pageSize") ?? "20";

  const page = Math.max(1, Number.parseInt(pageRaw, 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(pageSizeRaw, 10) || 20),
  );
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}

function toSafeInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) return fallback;

  return parsed;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIsoDateOnly(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function parseIsoDateOnly(value: string | null | undefined) {
  const raw = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;

  const parsed = new Date(`${raw}T00:00:00.000Z`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);

  next.setUTCDate(next.getUTCDate() + days);

  return next;
}

function diffDaysInclusive(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();

  return Math.floor(ms / 86_400_000) + 1;
}

export function parsePaginationStrict(
  searchParams: URLSearchParams,
  options?: {
    maxPageSize?: number;
    defaultPageSize?: number;
  },
) {
  const maxPageSize = Math.max(1, options?.maxPageSize ?? 100);
  const defaultPageSize = Math.min(
    maxPageSize,
    Math.max(1, options?.defaultPageSize ?? 20),
  );
  const page = Math.max(1, toSafeInt(searchParams.get("page"), 1));
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, toSafeInt(searchParams.get("pageSize"), defaultPageSize)),
  );

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function resolveDateRange(
  searchParams: URLSearchParams,
  options: {
    defaultDays: number;
    fromKey?: string;
    toKey?: string;
    now?: Date;
  },
) {
  const fromKey = options.fromKey ?? "dateFrom";
  const toKey = options.toKey ?? "dateTo";
  const defaultDays = Math.max(0, Math.floor(options.defaultDays));
  const now = options.now ?? new Date();
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const providedFrom = parseIsoDateOnly(searchParams.get(fromKey));
  const providedTo = parseIsoDateOnly(searchParams.get(toKey));
  const dateTo = providedTo ?? today;
  const dateFrom = providedFrom ?? addDays(dateTo, -defaultDays);

  return {
    dateFrom: toIsoDateOnly(dateFrom),
    dateTo: toIsoDateOnly(dateTo),
    usedDefaultFrom: !providedFrom,
    usedDefaultTo: !providedTo,
  };
}

export function ensureDateRange(
  searchParams: URLSearchParams,
  options: {
    defaultDays: number;
    maxDays: number;
    fromKey?: string;
    toKey?: string;
    now?: Date;
  },
) {
  const range = resolveDateRange(searchParams, options);
  const from = parseIsoDateOnly(range.dateFrom);
  const to = parseIsoDateOnly(range.dateTo);

  if (!from || !to) {
    throw new RangeError("Invalid date range.");
  }

  if (from.getTime() > to.getTime()) {
    throw new RangeError("dateFrom cannot be after dateTo.");
  }

  const maxDays = Math.max(1, Math.floor(options.maxDays));

  if (diffDaysInclusive(from, to) > maxDays) {
    throw new RangeError(`Date range cannot exceed ${maxDays} days.`);
  }

  return range;
}
