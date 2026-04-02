---
description: "Use when reporting code audit findings for forms, validations, business rules, permissions, or data integrity. Enforces consistent severity ordering, evidence quality, and test recommendations."
name: "Audit Findings Format"
---
# Audit Findings Format

Use this format for QA/audit outputs.

## Ordering
- Present findings first.
- Sort by severity: Critical, High, Medium, Low.
- Keep summary brief and only after findings.

## Required fields per finding
- Severity
- What is wrong
- Impact
- Evidence (specific file and line)
- Suggested fix
- Test needed

## Evidence quality rules
- Use concrete code references, not speculation.
- If impact is uncertain, state assumption explicitly.
- If verification was partial, add a coverage-gap note.

## Do not
- Do not prioritize style-only items over functional risks.
- Do not claim runtime behavior without code or test evidence.
- Do not omit security or data-integrity implications when relevant.