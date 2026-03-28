# AI Change Rules

Read this before changing backend list, export, sync, MES, scheduling, payments, or authorization code.

1. Every list must paginate.
2. `pageSize <= 100` always.
3. Large endpoints must use explicit filters or a backend default date range.
4. `rateLimit()` and `requirePermission()` are mandatory.
5. Advisor access is enforced server-side, never only in UI.
6. Avoid N+1 queries in list endpoints.
7. Massive export or sync flows must be jobs or require filters.
8. Do not remove existing response fields without confirming the UI contract.