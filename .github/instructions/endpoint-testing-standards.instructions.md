---
description: "Use when creating or modifying endpoints, server actions, or backend modules. Enforces test structure, minimum scenarios, and coverage expectations. Keywords: endpoint tests, api tests, integration tests, e2e, regression."
name: "Endpoint Testing Standards"
applyTo: "{app/api/**/route.ts,app/**/actions.ts,app/**/actions/**/*.ts,src/**/*.ts,utils/**/*.ts,tests/regression/**/*.test.ts,tests/templates/**/*.ts}"
---
# Endpoint Testing Standards

This is a hard rule for endpoint and backend-module work.

## Required test layers

- Add or update unit tests for validation schemas and core business functions.
- Add or update integration tests for endpoint/server action behavior with real request-response contracts.
- Add or update end-to-end tests for impacted user flows.

## Minimum scenarios per endpoint change

- Happy path success.
- Validation failures (invalid body, missing required fields, invalid types/formats).
- Auth/permission failure when endpoint is protected.
- Business-rule rejection (domain-specific constraints).
- Data-integrity guardrail (duplicate, conflict, or invalid state transition).

## Test file and naming conventions

- Place tests under tests/ using clear scope folders (unit, integration, e2e).
- Name files with behavior intent, for example: create-customer.endpoint.integration.test.ts.
- Keep one primary behavior group per test file to reduce brittle suites.

## Required assertions

- Assert status code and response shape.
- Assert stable error code/message contract for failures.
- Assert side effects in persistence or external calls where applicable.
- Assert no side effects when request is rejected.

## Definition of done

- Unit, integration, and e2e tests exist for impacted flows.
- New and changed tests pass in CI/local runs.
- No endpoint/module change is complete without these tests.
