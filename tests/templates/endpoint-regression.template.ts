import assert from "node:assert/strict";
import test from "node:test";

import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";

/**
 * Copy this template into tests/regression/<feature>.regression.test.ts
 * and replace the fake endpoint client with real calls to your route handler.
 */

type FakeResponse = {
  status: number;
  json: unknown;
};

async function fakeEndpointCall(payload: unknown): Promise<FakeResponse> {
  if (!payload || typeof payload !== "object") {
    return {
      status: 400,
      json: {
        code: "INVALID_REQUEST",
        message: "Invalid request body",
        fieldErrors: { body: ["Body must be an object"] },
      },
    };
  }

  const objectPayload = payload as Record<string, unknown>;
  if (!objectPayload.name || typeof objectPayload.name !== "string") {
    return {
      status: 400,
      json: {
        code: "VALIDATION_FAILED",
        message: "Validation failed",
        fieldErrors: { name: ["Name is required"] },
      },
    };
  }

  return {
    status: 201,
    json: {
      id: "created-id",
      name: objectPayload.name,
    },
  };
}

test("endpoint: happy path", async () => {
  const response = await fakeEndpointCall({ name: "Example" });
  assertStatus(response.status, 201);
  assert.equal(typeof response.json, "object");
});

test("endpoint: validation failure returns fieldErrors", async () => {
  const response = await fakeEndpointCall({});
  assertStatus(response.status, 400);
  assertErrorEnvelopeShape(response.json);
  assertFieldError(response.json, "name", "required");
});

test("endpoint: malformed request body is rejected", async () => {
  const response = await fakeEndpointCall(null);
  assertStatus(response.status, 400);
  assertErrorEnvelopeShape(response.json);
  assertFieldError(response.json, "body");
});

test("endpoint: auth/permission rejection sample", () => {
  const response = {
    status: 403,
    json: {
      code: "FORBIDDEN",
      message: "You do not have access to this resource",
    },
  };

  assertStatus(response.status, 403);
  assertErrorEnvelopeShape(response.json);
});

test("endpoint: business rule rejection sample", () => {
  const response = {
    status: 422,
    json: {
      code: "BUSINESS_RULE_VIOLATION",
      message: "Operation is not allowed in current state",
      fieldErrors: {
        status: ["Cannot transition from CLOSED to DRAFT"],
      },
    },
  };

  assertStatus(response.status, 422);
  assertErrorEnvelopeShape(response.json);
  assertFieldError(response.json, "status", "Cannot transition");
});
