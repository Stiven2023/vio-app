import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, externalAccessOtps } from "@/src/db/schema";
import { signExternalAccessToken } from "@/src/utils/auth";
import { rateLimit } from "@/src/utils/rate-limit";

const SESSION_MAX_AGE = 24 * 60 * 60;

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "external-auth:verify-token",
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const body = (await request.json()) as {
    clientCode?: string;
    audience?: string;
    token?: string;
  };

  const clientCode = String(body.clientCode ?? "")
    .trim()
    .toUpperCase();
  const audience = String(body.audience ?? "")
    .trim()
    .toUpperCase();
  const token = String(body.token ?? "").trim();

  if (!clientCode || !token) {
    return new Response("clientCode y token son obligatorios", { status: 400 });
  }

  if (audience !== "CLIENTE" && audience !== "TERCERO") {
    return new Response("audience inválido", { status: 400 });
  }

  const [client] = await db
    .select({
      id: clients.id,
      clientCode: clients.clientCode,
      status: clients.status,
      isActive: clients.isActive,
    })
    .from(clients)
    .where(eq(clients.clientCode, clientCode))
    .limit(1);

  if (!client) {
    return new Response("Cliente no encontrado", { status: 404 });
  }

  const clientStatus = String(client.status ?? "").toUpperCase();
  const isClientActive = clientStatus === "ACTIVO" && client.isActive !== false;

  if (!isClientActive) {
    return new Response("Cliente inactivo o suspendido", { status: 403 });
  }

  const [otp] = await db
    .select({
      id: externalAccessOtps.id,
      token: externalAccessOtps.token,
      expiresAt: externalAccessOtps.expiresAt,
    })
    .from(externalAccessOtps)
    .where(
      and(
        eq(externalAccessOtps.clientId, client.id),
        eq(externalAccessOtps.audience, audience),
        eq(externalAccessOtps.token, token),
        isNull(externalAccessOtps.usedAt),
      ),
    )
    .orderBy(desc(externalAccessOtps.createdAt))
    .limit(1);

  if (!otp) {
    return new Response("Token inválido", { status: 400 });
  }

  if (new Date(otp.expiresAt).getTime() < Date.now()) {
    return new Response("Token expirado", { status: 400 });
  }

  await db
    .update(externalAccessOtps)
    .set({ usedAt: new Date() })
    .where(eq(externalAccessOtps.id, otp.id));

  const signed = signExternalAccessToken({
    clientId: client.id,
    clientCode: String(client.clientCode),
    audience: audience as "CLIENTE" | "TERCERO",
  });

  const response = Response.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";

  response.headers.set(
    "Set-Cookie",
    `external_access_token=${signed}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE};${secure ? " Secure;" : ""}`,
  );

  return response;
}
