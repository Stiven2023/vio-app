import { eq, sql } from "drizzle-orm";

import { crmDb } from "@/src/db";
import { crmContacts, crmMessages } from "@/src/db/crm/schema";
import {
  jsonError,
  zodFirstErrorEnvelope,
  dbJsonError,
} from "@/src/utils/api-error";
import { rateLimit } from "@/src/utils/rate-limit";
import {
  mapWebhookStatusToMessageStatus,
  normalizeInboundMessageContent,
  normalizeWhatsappPhone,
  parseUnixSecondsToDate,
  whatsappWebhookPayloadSchema,
} from "@/src/utils/whatsapp";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "whatsapp:webhook:get",
    limit: 300,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const mode = String(searchParams.get("hub.mode") ?? "").trim();
  const verifyToken = String(searchParams.get("hub.verify_token") ?? "").trim();
  const challenge = String(searchParams.get("hub.challenge") ?? "").trim();

  if (mode !== "subscribe" || !challenge) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "Invalid webhook verification request.",
      {
        "hub.mode": ["Expected mode=subscribe and a valid challenge value."],
      },
    );
  }

  const expectedToken = String(process.env.WHATSAPP_VERIFY_TOKEN ?? "").trim();

  if (!expectedToken || verifyToken !== expectedToken) {
    return jsonError(
      403,
      "WEBHOOK_VERIFICATION_FAILED",
      "Webhook verification failed.",
    );
  }

  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "whatsapp:webhook:post",
    limit: 600,
    windowMs: 60_000,
  });

  if (limited) return limited;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "Request body must be valid JSON.",
      {
        body: ["Invalid JSON payload."],
      },
    );
  }

  const parsed = whatsappWebhookPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Invalid WhatsApp webhook payload.");
  }

  try {
    let createdMessages = 0;
    let duplicateMessages = 0;
    let updatedStatuses = 0;

    for (const entry of parsed.data.entry) {
      for (const change of entry.changes) {
        const value = change.value;
        const contacts = value.contacts ?? [];
        const contactNameByPhone = new Map<string, string>();

        for (const contact of contacts) {
          const normalizedPhone = normalizeWhatsappPhone(contact.wa_id);

          if (!normalizedPhone) continue;
          const profileName = String(contact.profile?.name ?? "").trim();

          if (profileName) {
            contactNameByPhone.set(normalizedPhone, profileName);
          }
        }

        for (const message of value.messages ?? []) {
          const phoneNumber = normalizeWhatsappPhone(message.from);

          if (!phoneNumber) continue;

          const interactionDate = parseUnixSecondsToDate(message.timestamp);
          const contactName = contactNameByPhone.get(phoneNumber) ?? null;

          const [contact] = await crmDb
            .insert(crmContacts)
            .values({
              phoneNumber,
              name: contactName,
              lastInteraction: interactionDate,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: crmContacts.phoneNumber,
              set: {
                name: sql`coalesce(excluded.name, ${crmContacts.name})`,
                lastInteraction: interactionDate,
                updatedAt: new Date(),
              },
            })
            .returning({ id: crmContacts.id });

          const content = normalizeInboundMessageContent(message);

          const inserted = await crmDb
            .insert(crmMessages)
            .values({
              whatsappId: message.id,
              content,
              type: String(message.type ?? "text"),
              direction: "INBOUND",
              status: "SENT",
              contactId: contact.id,
              createdAt: interactionDate,
              externalPayload: message,
            })
            .onConflictDoNothing({ target: crmMessages.whatsappId })
            .returning({ id: crmMessages.id });

          if (inserted.length > 0) {
            createdMessages += 1;
          } else {
            duplicateMessages += 1;
          }
        }

        for (const statusEvent of value.statuses ?? []) {
          const messageStatus = mapWebhookStatusToMessageStatus(statusEvent.status);

          const updated = await crmDb
            .update(crmMessages)
            .set({
              status: messageStatus,
              externalPayload: statusEvent,
            })
            .where(eq(crmMessages.whatsappId, statusEvent.id))
            .returning({ id: crmMessages.id });

          updatedStatuses += updated.length;
        }
      }
    }

    return Response.json({
      ok: true,
      createdMessages,
      duplicateMessages,
      updatedStatuses,
    });
  } catch (error) {
    return (
      dbJsonError(error, "Failed to process WhatsApp webhook event.") ||
      jsonError(500, "INTERNAL_ERROR", "Unexpected server error.")
    );
  }
}
