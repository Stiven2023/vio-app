import { verifyExternalAccessToken } from "@/src/utils/auth";
import { db } from "@/src/db";
import { clients } from "@/src/db/schema";
import { eq } from "drizzle-orm";

function getCookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie");

  if (!cookie) return null;

  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));

  return match ? match[1] : null;
}

export function getExternalAccessFromRequest(request: Request) {
  const token = getCookieValue(request, "external_access_token");

  if (!token) return null;

  return verifyExternalAccessToken(token);
}

export function requireExternalAccess(request: Request) {
  const payload = getExternalAccessFromRequest(request);

  if (!payload) {
    return {
      error: new Response("Unauthorized", { status: 401 }),
      payload: null,
    } as const;
  }

  return {
    error: null,
    payload,
  } as const;
}

export async function requireExternalAccessActiveClient(request: Request) {
  const { error, payload } = requireExternalAccess(request);

  if (error || !payload) {
    return {
      error: error ?? new Response("Unauthorized", { status: 401 }),
      payload: null,
      client: null,
    } as const;
  }

  const [client] = await db
    .select({
      id: clients.id,
      clientCode: clients.clientCode,
      status: clients.status,
      isActive: clients.isActive,
    })
    .from(clients)
    .where(eq(clients.id, payload.clientId))
    .limit(1);

  if (!client) {
    return {
      error: new Response("Unauthorized", { status: 401 }),
      payload: null,
      client: null,
    } as const;
  }

  const clientStatus = String(client.status ?? "").toUpperCase();
  const isClientActive = clientStatus === "ACTIVO" && client.isActive !== false;

  if (!isClientActive) {
    return {
      error: new Response("Client is inactive or suspended", { status: 403 }),
      payload: null,
      client: null,
    } as const;
  }

  return {
    error: null,
    payload,
    client,
  } as const;
}
