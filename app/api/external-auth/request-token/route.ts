import crypto from "crypto";
import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, externalAccessOtps } from "@/src/db/schema";
import { sendExternalAccessToken } from "@/src/utils/gmail";
import { rateLimit } from "@/src/utils/rate-limit";

const OTP_TTL_MS = 3 * 60_000;

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "external-auth:request-token",
    limit: 10,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const body = (await request.json()) as {
    clientCode?: string;
    audience?: string;
  };

  const clientCode = String(body.clientCode ?? "").trim().toUpperCase();
  const audience = String(body.audience ?? "").trim().toUpperCase();

  if (!clientCode) {
    return new Response("clientCode es obligatorio", { status: 400 });
  }

  if (audience !== "CLIENTE" && audience !== "TERCERO") {
    return new Response("audience inválido", { status: 400 });
  }

  const [client] = await db
    .select({
      id: clients.id,
      clientCode: clients.clientCode,
      email: clients.email,
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

  if (!client.email || String(client.email).trim() === "") {
    return new Response("El cliente no tiene correo asociado", { status: 400 });
  }

  const [lastOtp] = await db
    .select({ resendAvailableAt: externalAccessOtps.resendAvailableAt })
    .from(externalAccessOtps)
    .where(eq(externalAccessOtps.clientId, client.id))
    .orderBy(desc(externalAccessOtps.createdAt))
    .limit(1);

  const now = Date.now();
  const resendAt = lastOtp?.resendAvailableAt ? new Date(lastOtp.resendAvailableAt).getTime() : 0;

  if (resendAt > now) {
    return Response.json(
      {
        ok: false,
        message: "Debes esperar para solicitar un nuevo token",
        retryAt: new Date(resendAt).toISOString(),
      },
      { status: 429 },
    );
  }

  const token = String(crypto.randomInt(100_000, 1_000_000));
  const expiresAt = new Date(now + OTP_TTL_MS);
  const resendAvailableAt = new Date(now + OTP_TTL_MS);

  await db.insert(externalAccessOtps).values({
    clientId: client.id,
    clientCode: client.clientCode,
    audience,
    token,
    expiresAt,
    resendAvailableAt,
  });

  await sendExternalAccessToken({
    to: String(client.email),
    token,
    audience: audience as "CLIENTE" | "TERCERO",
    clientCode: String(client.clientCode),
  });

  return Response.json({
    ok: true,
    message: "Token enviado al correo asociado",
    retryAt: resendAvailableAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
}
