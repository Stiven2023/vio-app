---
description: "Use when you need a reusable QA checklist audit for forms, validations, and business rules by module or full app. Trigger words: checklist formularios, auditoria QA, validar reglas, form validation checklist, business rules checklist."
name: "Forms QA Checklist"
argument-hint: "Provide scope (all|module:<name>), depth (quick|standard|deep), and action mode (report-only|report+fix-obvious)."
agent: "Forms + Business Rules Auditor"
---
Run a forms and business-rules audit with the provided arguments.

Inputs:
- Scope: all or module:<name>
- Depth: quick, standard, or deep
- Action mode: report-only or report+fix-obvious

If an input is missing, use defaults:
- Scope: all
- Depth: standard
- Action mode: report+fix-obvious

Required behavior:
1. Map all form entry points and submit handlers in the selected scope.
2. Validate client and server parity for schemas, constraints, and error messages.
3. Verify business-rule enforcement in server actions, API routes, and services.
4. Verify authorization checks for create/update/delete paths tied to forms.
5. Report evidence-backed findings only, with exact file and line links.

Output order:
1. Findings (Critical -> High -> Medium -> Low)
2. Open questions or assumptions
3. Coverage gaps
4. Optional fix summary (only if edits were made)

For each finding include:
- Severity
- Impact
- Evidence
- Suggested fix
- Test needed