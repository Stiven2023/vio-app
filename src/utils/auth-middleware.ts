import { verifyAuthToken } from "@/src/utils/auth";

export function getAuthFromRequest(request: Request) {
  const cookie = request.headers.get("cookie");

  if (!cookie) return null;
  const match = cookie.match(/auth_token=([^;]+)/);

  if (!match) return null;
  const token = match[1];
  const payload = verifyAuthToken(token);

  return payload || null;
}

export function getRoleFromRequest(request: Request): string | null {
  const auth = getAuthFromRequest(request);
  const role = auth && typeof auth === "object" ? (auth as { role?: unknown }).role : null;

  return typeof role === "string" && role.trim() !== "" ? role : null;
}

export function requireRole(request: Request, allowedRoles: string[]) {
  const role = getRoleFromRequest(request);

  if (!role || !allowedRoles.includes(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  return null; // autorizado
}
