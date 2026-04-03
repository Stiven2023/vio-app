---
description: "Use when creating or modifying any endpoint, server action, or module (new or existing). Enforces Zod validation, focus on first invalid field, and mandatory unit/integration/e2e test coverage. Keywords: endpoint validation, module validation, zod, focus error field, api testing, business rules."
name: "Endpoint And Module Validation + Testing"
applyTo: "{app/api/**/route.ts,app/**/actions.ts,app/**/actions/**/*.ts,app/**/_components/**/*.tsx,components/**/*.tsx,src/**/*.ts,utils/**/*.ts,tests/regression/**/*.test.ts,tests/templates/**/*.ts}"
---
# Endpoint and Module Quality Gate

This is a hard rule for all endpoints and modules, including updates to existing ones.

## Required validation layer

- Add explicit input validation for every entry point (API routes, server actions, form submit handlers) using Zod.
- Validate business rules on the server side, even if the UI also validates.
- Return structured, actionable validation errors (field + reason).
- Do not merge code that accepts unchecked payloads.

## Required UX error focus behavior

- For any form or multi-field input flow, move focus to the first invalid field after validation fails.
- If the first invalid field is outside the viewport, ensure it is brought into view before or while focusing.
- Keep field-level error messages visible and linked to the focused field.

## Required tests

- Every endpoint (new or modified) must include automated tests for:
  - happy path
  - validation failures
  - permission/auth failures (when applicable)
  - business-rule rejection cases
- Every module (new or modified) must include tests for critical flows and rule enforcement.
- E2E coverage is mandatory (not optional) for impacted endpoint/module flows.
- If UI forms are added/changed, include tests that verify focus jumps to the first invalid field.

## Definition of done

- Validation implemented at all entry points.
- Focus-on-error behavior implemented for affected forms.
- Tests added and passing for endpoint/module behavior and validation failures.
- No task is complete without these three checks.
