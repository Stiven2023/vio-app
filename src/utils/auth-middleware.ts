import { verifyAuthToken, verifyMesAccessToken } from "@/src/utils/auth";

type AuthPayload = ReturnType<typeof verifyAuthToken>;
type MesAccessPayload = ReturnType<typeof verifyMesAccessToken>;

type SessionPreferenceOptions = {
  preferMesSession?: boolean;
};

export type ResolvedSession = {
  sessionType: "auth" | "mes" | null;
  auth: AuthPayload;
  mesAccess: MesAccessPayload;
  authRole: string | null;
  mesRole: string | null;
  role: string | null;
  userId: string | null;
  employeeId: string | null;
  email: string | null;
};

function readCookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie");

  if (!cookie) return null;

  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));

  return match ? match[1] : null;
}

function getMesAccessPayload(request: Request) {
  const token = readCookieValue(request, "mes_access_token");
  if (!token) return null;
  return verifyMesAccessToken(token);
}

function getStringClaim(
  payload: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = payload?.[key];

  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function shouldPreferMesSession(
  request: Request,
  options?: SessionPreferenceOptions,
) {
  if (typeof options?.preferMesSession === "boolean") {
    return options.preferMesSession;
  }

  try {
    const pathname = new URL(request.url).pathname;

    return pathname === "/api/auth/me" || pathname.startsWith("/api/mes/");
  } catch {
    return false;
  }
}

export function getAuthFromRequest(request: Request) {
  const token = readCookieValue(request, "auth_token");
  if (!token) return null;
  return verifyAuthToken(token) || null;
}

export function resolveSessionFromRequest(
  request: Request,
  options?: SessionPreferenceOptions,
): ResolvedSession {
  const auth = getAuthFromRequest(request);
  const mesAccess = getMesAccessPayload(request);
  const authRecord =
    auth && typeof auth === "object" ? (auth as Record<string, unknown>) : null;
  const preferMesSession = shouldPreferMesSession(request, options);
  const authRole = getStringClaim(authRecord, "role");
  const mesRole = mesAccess?.role ?? null;
  const sessionType = mesAccess ? "mes" : auth ? "auth" : null;
  const userId = preferMesSession
    ? mesAccess?.userId ?? getStringClaim(authRecord, "userId")
    : getStringClaim(authRecord, "userId") ?? mesAccess?.userId ?? null;
  const employeeId = preferMesSession
    ? mesAccess?.employeeId ?? getStringClaim(authRecord, "employeeId")
    : getStringClaim(authRecord, "employeeId") ?? mesAccess?.employeeId ?? null;
  const email = preferMesSession
    ? mesAccess?.email ?? getStringClaim(authRecord, "email")
    : getStringClaim(authRecord, "email") ?? mesAccess?.email ?? null;
  const role = preferMesSession
    ? mesRole ?? authRole ?? null
    : authRole ?? mesRole ?? null;

  return {
    sessionType,
    auth,
    mesAccess,
    authRole,
    mesRole,
    role,
    userId,
    employeeId,
    email,
  };
}

export function getRoleFromRequest(
  request: Request,
  options?: SessionPreferenceOptions,
): string | null {
  const session = resolveSessionFromRequest(request, options);

  if (process.env.NODE_ENV !== "production" && session.authRole === "ADMINISTRADOR") {
    const override = readCookieValue(request, "role_override");

    if (override && override.trim() !== "") return override.trim();
  }

  return session.role;
}

export function getUserIdFromRequest(
  request: Request,
  options?: SessionPreferenceOptions,
): string | null {
  return resolveSessionFromRequest(request, options).userId;
}

export function getEmployeeIdFromRequest(
  request: Request,
  options?: SessionPreferenceOptions,
): string | null {
  return resolveSessionFromRequest(request, options).employeeId;
}

export function getEmailFromRequest(
  request: Request,
  options?: SessionPreferenceOptions,
): string | null {
  const email = resolveSessionFromRequest(request, options).email;

  return email ? email.toLowerCase() : null;
}

export function getMesAccessFromRequest(request: Request) {
  return getMesAccessPayload(request);
}

export function requireRole(request: Request, allowedRoles: string[]) {
  const role = getRoleFromRequest(request);

  if (!role || !allowedRoles.includes(role)) {
    return new Response("Access denied", { status: 403 });
  }

  return null;
}
