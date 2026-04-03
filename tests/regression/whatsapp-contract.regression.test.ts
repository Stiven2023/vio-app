import assert from "node:assert/strict";
import test from "node:test";

import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import {
  isWindowOpen,
  mapWebhookStatusToMessageStatus,
  normalizeWhatsappPhone,
  parseUnixSecondsToDate,
  whatsappSendSchema,
  whatsappWebhookPayloadSchema,
} from "@/src/utils/whatsapp";
import {
  assertErrorEnvelopeShape,
  assertFieldError,
  assertStatus,
} from "@/tests/templates/endpoint-test-helpers";

test("whatsapp contract: normalizes E.164 numbers without plus", () => {
  assert.equal(normalizeWhatsappPhone("+573001112233"), "573001112233");
  assert.equal(normalizeWhatsappPhone(" 573001112233 "), "573001112233");
});

test("whatsapp contract: rejects invalid phone formats", () => {
  assert.equal(normalizeWhatsappPhone("abc"), null);
  assert.equal(normalizeWhatsappPhone("12345"), null);
  assert.equal(normalizeWhatsappPhone("003001112233"), null);
});

test("whatsapp contract: validates 24h window correctly", () => {
  const now = new Date("2026-04-03T12:00:00.000Z");
  const insideWindow = new Date("2026-04-02T13:00:01.000Z");
  const outsideWindow = new Date("2026-04-02T11:59:59.000Z");

  assert.equal(isWindowOpen(insideWindow, now), true);
  assert.equal(isWindowOpen(outsideWindow, now), false);
});

test("whatsapp contract: parses unix timestamp seconds", () => {
  const date = parseUnixSecondsToDate("1712102400");

  assert.equal(Number.isNaN(date.getTime()), false);
  assert.equal(date.toISOString().startsWith("2024-04-03"), true);
});

test("whatsapp contract: maps provider statuses", () => {
  assert.equal(mapWebhookStatusToMessageStatus("sent"), "SENT");
  assert.equal(mapWebhookStatusToMessageStatus("delivered"), "DELIVERED");
  assert.equal(mapWebhookStatusToMessageStatus("read"), "READ");
  assert.equal(mapWebhookStatusToMessageStatus("failed"), "FAILED");
});

test("whatsapp contract: webhook payload requires object and entry", () => {
  const result = whatsappWebhookPayloadSchema.safeParse({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: "wamid.abc",
                  from: "573001112233",
                  timestamp: "1712102400",
                  type: "text",
                  text: { body: "Hello" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  assert.equal(result.success, true);
});

test("whatsapp contract: send schema needs text or template", () => {
  const result = whatsappSendSchema.safeParse({
    contactId: "6a83be0d-508e-4ff5-8d8d-f8fcdf1d56a4",
  });

  assert.equal(result.success, false);
  if (result.success) return;

  const envelope = zodFirstErrorEnvelope(result.error, "Invalid payload.");
  assertStatus(envelope.status, 400);

  return envelope.json().then((payload) => {
    assertErrorEnvelopeShape(payload);
    assertFieldError(payload, "text");
  });
});

test("whatsapp contract: error envelope shape is stable", async () => {
  const response = jsonError(
    422,
    "WHATSAPP_TEMPLATE_REQUIRED",
    "Template is required.",
    {
      templateName: ["Template is required when the 24-hour window is closed."],
    },
  );

  assertStatus(response.status, 422);

  const payload = (await response.json()) as {
    code: string;
    fieldErrors?: Record<string, string[]>;
  };

  assertErrorEnvelopeShape(payload);

  assert.equal(payload.code, "WHATSAPP_TEMPLATE_REQUIRED");
  assert.ok(payload.fieldErrors?.templateName?.[0]);
});
