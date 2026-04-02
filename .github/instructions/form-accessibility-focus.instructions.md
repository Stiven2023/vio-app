---
description: "Use when building or changing forms and validation UX. Enforces accessible error semantics, focus management, and keyboard/screen-reader compatibility. Keywords: form accessibility, focus management, aria-invalid, aria-describedby, validation UX."
name: "Form Accessibility + Focus On Error"
applyTo: "{app/**/*.tsx,components/**/*.tsx,tests/regression/**/*.test.ts,tests/templates/**/*.ts}"
---
# Form Accessibility and Error Focus Rules

This is a hard rule for forms and multi-field input flows.

## Required accessibility semantics

- Mark invalid controls with aria-invalid="true".
- Link each invalid control to its error message with aria-describedby.
- Ensure each field has a stable accessible name via label or aria-label.
- Present summary-level error feedback in a polite live region when form submit fails.

## Required focus behavior

- After failed validation, move focus to the first invalid field.
- If the field is off-screen, scroll it into view before or while focusing.
- Preserve keyboard flow; do not trap focus in non-modal contexts.
- Keep error message visible at focus target.

## Required keyboard and assistive-tech behavior

- All fields and submit actions must be fully operable via keyboard.
- Error messages must be announced and discoverable by screen readers.
- Focus order must follow visual and logical order.

## Required tests for form changes

- Add tests that assert focus moves to first invalid field after submit.
- Add tests that assert aria-invalid and aria-describedby are set correctly.
- Add tests that assert the error summary/live-region content is rendered on failure.

## Definition of done

- Validation errors are accessible and linked to fields.
- Focus-on-error is implemented and tested.
- Keyboard and screen-reader critical paths are validated.
