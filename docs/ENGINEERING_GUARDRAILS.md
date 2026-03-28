# Engineering Guardrails

Before changing list endpoints, exports, sync flows, or high-volume dashboards, follow these rules.

## Mandatory rules

1. Every list endpoint must paginate.
2. `pageSize` defaults to 20 and must never exceed 100.
3. Large endpoints must filter by date or apply a backend default date window.
4. `rateLimit()` and `requirePermission()` are required in protected endpoints.
5. Advisor access must be scoped server-side to owned resources only.
6. Avoid N+1 queries in list endpoints.
7. Massive exports or sync operations must run as jobs or require narrow filters.

## Default backend date windows

- Orders, designs, scheduling, and MES queues: last 30 days.
- Payments, extracts, consignments, reconciliation: last 90 days.
- Operative MES logs: last 7 days.

When no date filters are sent:

- `dateTo = today`
- `dateFrom = dateTo - N days`

Apply defaults in the backend, not only in the UI.

## Pagination standard

- Use `parsePaginationStrict(searchParams, { defaultPageSize: 20, maxPageSize: 100 })`.
- Return `page`, `pageSize`, `total`, and `hasNextPage` whenever the endpoint is list-shaped.

## Date range standard

- Use `ensureDateRange(searchParams, { defaultDays, maxDays })` in large endpoints.
- Keep ranges bounded. Recommended `maxDays`: 365 unless a stricter rule applies.
- Support legacy parameter names only if an existing UI already depends on them.

## Authorization standard

- Permission checks are necessary but not sufficient.
- If the action is restricted by role or ownership, validate that in the backend.
- Never trust frontend filtering or hidden buttons for resource protection.

## Query performance standard

- Do not fetch thousands of rows and trim in memory if the database can filter first.
- Do not run `Promise.all` per row in list endpoints.
- Prefer grouped queries, joins, CTEs, window functions, or batched lookups.

## Export and sync standard

- If an operation can touch many rows, prefer a job model.
- Apply stronger rate limits for exports and sync retries.
- Require filters or a default date window for bulk operations.

See also `docs/AI_CHANGE_RULES.md` and `docs/SECURITY_PERF_CHECKLIST.md`.