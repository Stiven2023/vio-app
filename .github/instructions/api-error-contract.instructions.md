---
description: "Use when implementing or changing API endpoints/server actions. Enforces a stable error contract with consistent shape, machine-readable codes, and UI mapping rules. Keywords: api error contract, error shape, error code, validation errors, client mapping."
name: "API Error Contract"
applyTo: "{app/api/**/route.ts,app/**/actions.ts,app/**/actions/**/*.ts,types/**/*.ts,src/types/**/*.ts,tests/regression/**/*.test.ts,tests/templates/**/*.ts}"
---
# API Error Contract Rules

This is a hard rule for endpoint and server-action error responses.

## Required error envelope

- Return a single, consistent error object shape for all non-2xx responses.
- Required fields:
  - code: stable machine-readable error code.
  - message: user-safe and actionable message.
  - fieldErrors: optional map of field to message list for validation failures.
  - requestId: optional trace identifier for observability.

## Required mapping rules

- Validation errors must include fieldErrors with exact field keys expected by UI forms.
- Auth/permission errors must use dedicated codes, not generic messages.
- Business-rule violations must use domain-specific codes.
- Do not leak stack traces, SQL errors, or internal exception details.

## Status-code rules

- 400 for malformed requests and schema validation failures.
- 401 for unauthenticated requests.
- 403 for authenticated but unauthorized requests.
- 404 when resource is not found.
- 409 for conflicts or invalid state transitions.
- 422 for semantic validation/business-rule failures when distinct from malformed input.
- 500 only for unexpected server failures.

## Client compatibility rules

- Keep error codes backward compatible once published.
- Any error-contract change requires coordinated updates in client mapping and tests.
- Frontend forms must map fieldErrors directly to per-field UI errors and focus logic.

## Required tests

- Add tests for error envelope shape per failure category.
- Add tests for stable error code values.
- Add tests that validate fieldErrors map keys expected by the UI.

## Definition of done

- Error envelope is consistent across changed endpoints/actions.
- Codes/messages are deterministic and safe.
- Contract tests pass and client mapping remains compatible.
