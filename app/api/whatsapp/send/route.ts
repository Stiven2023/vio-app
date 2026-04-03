import { eq } from "drizzle-orm";

import { crmDb } from "@/src/db";
import { crmContacts, crmMessages } from "@/src/db/crm/schema";
import {
  dbJsonError,
  jsonError,
  jsonNotFound,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { getUserIdFromRequest } from "@/src/utils/auth-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import {
  isWindowOpen,
  whatsappSendSchema,
} from "@/src/utils/whatsapp";

const META_API_BASE = "https://graph.facebook.com/v18.0";

type MetaSendResponse = {
  messages?: Array<{ id?: string }>;
  error?: { message?: string };
};

function getWhatsAppConfig() {
  const token = String(process.env.WHATSAPP_TOKEN ?? "").trim();
  const phoneNumberId = String(process.env.PHONE_NUMBER_ID ?? "").trim();

  if (!token || !phoneNumberId) {
    return null;
  }

  return { token, phoneNumberId };
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "whatsapp:send:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const userId = getUserIdFromRequest(request);

  if (!userId) {
    return jsonError(401, "UNAUTHENTICATED", "Authentication is required.");
  }

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

  const parsed = whatsappSendSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Invalid send request payload.");
  }

  const config = getWhatsAppConfig();

  if (!config) {
    return jsonError(
      500,
      "CONFIG_ERROR",
      "WhatsApp integration is not configured.",
    );
  }

  const payload = parsed.data;

  try {
    const [contact] = await crmDb
      .select({
        id: crmContacts.id,
        phoneNumber: crmContacts.phoneNumber,
        lastInteraction: crmContacts.lastInteraction,
      })
      .from(crmContacts)
      .where(eq(crmContacts.id, payload.contactId))
      .limit(1);

    if (!contact) {
      return jsonNotFound("Contact was not found.");
    }

    const windowOpen = isWindowOpen(new Date(contact.lastInteraction));

    if (!windowOpen && !payload.templateName) {
      return jsonError(
        422,
        "WHATSAPP_TEMPLATE_REQUIRED",
        "The 24-hour window is closed. Send an approved template.",
        {
          templateName: ["Template is required when the 24-hour window is closed."],
        },
      );
    }

    if (windowOpen && !payload.text) {
      return jsonError(
        422,
        "VALIDATION_ERROR",
        "Text is required while the 24-hour window is open.",
        {
          text: ["Provide a message text to send."],
        },
      );
    }

    const endpoint = `${META_API_BASE}/${config.phoneNumberId}/messages`;
    const outgoingBody = windowOpen
      ? {
          messaging_product: "whatsapp",
          to: contact.phoneNumber,
          type: "text",
          text: { body: payload.text! },
        }
      : {
          messaging_product: "whatsapp",
          to: contact.phoneNumber,
          type: "template",
          template: {
            name: payload.templateName!,
            language: { code: payload.languageCode },
          },
        };

    const providerResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(outgoingBody),
    });

    const providerPayload =
      ((await providerResponse.json().catch(() => ({}))) as MetaSendResponse) ||
      {};

    const providerMessageId =
      String(providerPayload.messages?.[0]?.id ?? "").trim() ||
      `local-${crypto.randomUUID()}`;

    if (!providerResponse.ok) {
      await crmDb.insert(crmMessages).values({
        whatsappId: providerMessageId,
        content: payload.text ?? `[template:${payload.templateName}]`,
        type: windowOpen ? "text" : "template",
        direction: "OUTBOUND",
        status: "FAILED",
        contactId: contact.id,
        externalPayload: providerPayload,
      });

      return jsonError(
        502,
        "WHATSAPP_SEND_FAILED",
        "WhatsApp provider rejected the message.",
        {
          provider: [String(providerPayload.error?.message ?? "Unknown provider error.")],
        },
      );
    }

    const now = new Date();

    await crmDb.transaction(async (tx) => {
      await tx.insert(crmMessages).values({
        whatsappId: providerMessageId,
        content: payload.text ?? `[template:${payload.templateName}]`,
        type: windowOpen ? "text" : "template",
        direction: "OUTBOUND",
        status: "SENT",
        contactId: contact.id,
        externalPayload: providerPayload,
      });

      await tx
        .update(crmContacts)
        .set({
          lastInteraction: now,
          updatedAt: now,
        })
        .where(eq(crmContacts.id, contact.id));
    });

    return Response.json({
      ok: true,
      contactId: contact.id,
      whatsappId: providerMessageId,
      windowOpen,
      usedTemplate: !windowOpen,
    });
  } catch (error) {
    return (
      dbJsonError(error, "Failed to send WhatsApp message.") ||
      jsonError(500, "INTERNAL_ERROR", "Unexpected server error.")
    );
  }
}
