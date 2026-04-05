import { verifyAuthToken, verifyMesAccessToken } from "@/src/utils/auth";

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

export function getAuthFromRequest(request: Request) {
  const token = readCookieValue(request, "auth_token");
  if (!token) return null;
  return verifyAuthToken(token) || null;
}

export function getRoleFromRequest(request: Request): string | null {
  const auth = getAuthFromRequest(request);
  const role =
    auth && typeof auth === "object" ? (auth as { role?: unknown }).role : null;

  const baseRole =
    typeof role === "string" && role.trim() !== "" ? role.trim() : null;

  if (process.env.NODE_ENV !== "production" && baseRole === "ADMINISTRADOR") {
    const override = readCookieValue(request, "role_override");

    if (override && override.trim() !== "") return override.trim();
  }

  if (baseRole) return baseRole;

  const mesPayload = getMesAccessPayload(request);
  return mesPayload?.role ?? null;
}

export function getUserIdFromRequest(request: Request): string | null {
  const auth = getAuthFromRequest(request);
  const userId =
    auth && typeof auth === "object"
      ? (auth as { userId?: unknown }).userId
      : null;

  if (typeof userId === "string" && userId.trim() !== "") {
    return userId;
  }

  const mesPayload = getMesAccessPayload(request);
  return mesPayload?.userId ?? null;
}

export function getEmployeeIdFromRequest(request: Request): string | null {
  const auth = getAuthFromRequest(request);
  const employeeId =
    auth && typeof auth === "object"
      ? (auth as { employeeId?: unknown }).employeeId
      : null;

  if (typeof employeeId === "string" && employeeId.trim() !== "") {
    return employeeId;
  }

  const mesPayload = getMesAccessPayload(request);
  return mesPayload?.employeeId ?? null;
}

export function getEmailFromRequest(request: Request): string | null {
  const auth = getAuthFromRequest(request);
  const email =
    auth && typeof auth === "object" ? (auth as { email?: unknown }).email : null;

  if (typeof email === "string" && email.trim() !== "") {
    return email.trim().toLowerCase();
  }

  const mesPayload = getMesAccessPayload(request);
  return mesPayload?.email ?? null;
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
