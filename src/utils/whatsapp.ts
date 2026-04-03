import { z } from "zod";

export const E164_DIGITS_REGEX = /^[1-9]\d{7,14}$/;

export function normalizeWhatsappPhone(value: unknown): string | null {
  const digits = String(value ?? "")
    .trim()
    .replace(/^\+/, "")
    .replace(/\s+/g, "");

  if (!E164_DIGITS_REGEX.test(digits)) return null;

  return digits;
}

export function isWindowOpen(lastDate: Date, now = new Date()): boolean {
  const diffHours =
    (now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60);

  return Number.isFinite(diffHours) && diffHours < 24;
}

export function parseUnixSecondsToDate(value: unknown): Date {
  const raw = Number(String(value ?? "").trim());

  if (!Number.isFinite(raw) || raw <= 0) return new Date();

  return new Date(raw * 1000);
}

export function normalizeInboundMessageContent(message: {
  type?: string;
  text?: { body?: string };
}): string {
  if (message.type === "text") {
    const text = String(message.text?.body ?? "").trim();

    return text || "[empty text message]";
  }

  return `[${String(message.type ?? "unknown")}]`;
}

export function mapWebhookStatusToMessageStatus(
  status: string,
): "SENT" | "DELIVERED" | "READ" | "FAILED" {
  switch (status.toLowerCase()) {
    case "delivered":
      return "DELIVERED";
    case "read":
      return "READ";
    case "failed":
      return "FAILED";
    default:
      return "SENT";
  }
}

export const whatsappWebhookMessageSchema = z
  .object({
    id: z.string().trim().min(1),
    from: z.string().trim().min(1),
    timestamp: z.string().trim().min(1),
    type: z.string().trim().min(1).default("text"),
    text: z
      .object({
        body: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

export const whatsappWebhookStatusSchema = z
  .object({
    id: z.string().trim().min(1),
    status: z.string().trim().min(1),
    timestamp: z.string().trim().min(1).optional(),
    recipient_id: z.string().trim().min(1).optional(),
  })
  .passthrough();

export const whatsappWebhookPayloadSchema = z
  .object({
    object: z.literal("whatsapp_business_account"),
    entry: z
      .array(
        z
          .object({
            changes: z.array(
              z
                .object({
                  value: z
                    .object({
                      messaging_product: z.string().optional(),
                      contacts: z
                        .array(
                          z
                            .object({
                              wa_id: z.string().trim().min(1),
                              profile: z
                                .object({
                                  name: z.string().trim().min(1).optional(),
                                })
                                .optional(),
                            })
                            .passthrough(),
                        )
                        .optional(),
                      messages: z.array(whatsappWebhookMessageSchema).optional(),
                      statuses: z.array(whatsappWebhookStatusSchema).optional(),
                    })
                    .passthrough(),
                })
                .passthrough(),
            ),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();

export const whatsappSendSchema = z
  .object({
    contactId: z.string().uuid("contactId must be a valid UUID."),
    text: z.string().trim().min(1).max(4096).optional(),
    templateName: z.string().trim().min(1).max(120).optional(),
    languageCode: z.string().trim().min(2).max(20).default("es_CO"),
  })
  .superRefine((value, ctx) => {
    if (!value.text && !value.templateName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["text"],
        message: "Provide text or templateName.",
      });
    }
  });

export type WhatsappWebhookPayload = z.infer<typeof whatsappWebhookPayloadSchema>;
export type WhatsappSendPayload = z.infer<typeof whatsappSendSchema>;
