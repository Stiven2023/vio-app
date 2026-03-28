# Security and Performance Checklist

- Pagination added and bounded.
- Default backend date range applied where needed.
- Permission and role scope validated server-side.
- No obvious N+1 query in list endpoints.
- No unbounded export or sync in a single request.
- Rate limit added or preserved.
- UI contract preserved.