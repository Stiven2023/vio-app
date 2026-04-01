import assert from "node:assert/strict";

type ErrorEnvelope = {
  code?: unknown;
  message?: unknown;
  fieldErrors?: unknown;
  requestId?: unknown;
};

export function assertStatus(actual: number, expected: number): void {
  assert.equal(actual, expected, `Expected status ${expected} but received ${actual}`);
}

export function assertErrorEnvelopeShape(payload: unknown): asserts payload is ErrorEnvelope {
  assert.equal(typeof payload, "object", "Error payload must be an object");
  assert.notEqual(payload, null, "Error payload cannot be null");

  const envelope = payload as Record<string, unknown>;
  assert.equal(typeof envelope.code, "string", "Error code must be a string");
  assert.equal(typeof envelope.message, "string", "Error message must be a string");

  if ("fieldErrors" in envelope && envelope.fieldErrors !== undefined) {
    assert.equal(
      typeof envelope.fieldErrors,
      "object",
      "fieldErrors must be an object when present",
    );
    assert.notEqual(envelope.fieldErrors, null, "fieldErrors cannot be null when present");
  }

  if ("requestId" in envelope && envelope.requestId !== undefined) {
    assert.equal(typeof envelope.requestId, "string", "requestId must be a string when present");
  }
}

export function assertFieldError(
  payload: ErrorEnvelope,
  fieldName: string,
  expectedMessageFragment?: string,
): void {
  assert.ok(payload.fieldErrors && typeof payload.fieldErrors === "object", "Expected fieldErrors map");

  const map = payload.fieldErrors as Record<string, unknown>;
  assert.ok(fieldName in map, `Expected fieldErrors to include key: ${fieldName}`);

  const value = map[fieldName];
  if (expectedMessageFragment) {
    const serialized = JSON.stringify(value);
    assert.match(serialized, new RegExp(expectedMessageFragment), "Expected matching field error message");
  }
}

export function assertNoSideEffects(counterBefore: number, counterAfter: number): void {
  assert.equal(counterAfter, counterBefore, "Expected no side effects in rejected request path");
}
