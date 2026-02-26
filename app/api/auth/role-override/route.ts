import { cookies } from "next/headers";

import { verifyAuthToken } from "@/src/utils/auth";

const ALLOWED_ROLES = [
  "ADMINISTRADOR",
  "LIDER_JURIDICA",
  "RH",
  "AUXILIAR_RH",
  "LIDER_FINANCIERA",
  "AUXILIAR_CONTABLE",
  "TESORERIA_Y_CARTERA",
  "LIDER_COMERCIAL",
  "ASESOR",
  "LIDER_SUMINISTROS",
  "COMPRA_NACIONAL",
  "COMPRA_INTERNACIONAL",
  "LIDER_DISEÑO",
  "DISEÑADOR",
  "LIDER_OPERACIONAL",
  "PROGRAMACION",
  "OPERARIO_DESPACHO",
  "OPERARIO_BODEGA",
  "OPERARIO_FLOTER",
  "OPERARIO_INTEGRACION_CALIDAD",
  "OPERARIO_CORTE_LASER",
  "OPERARIO_CORTE_MANUAL",
  "OPERARIO_MONTAJE",
  "OPERARIO_SUBLIMACION",
  "MENSAJERO",
  "CONFECCIONISTA",
  "EMPAQUE",
];

function requireDevEnvironment(): Response | null {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  return null;
}

async function requireAdminRole(): Promise<Response | null> {
  const token = (await cookies()).get("auth_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;
  const role =
    payload && typeof payload === "object"
      ? (payload as { role?: unknown }).role
      : null;

  if (!payload) return new Response("Unauthorized", { status: 401 });
  if (role !== "ADMINISTRADOR") return new Response("Forbidden", { status: 403 });

  return null;
}

export async function GET() {
  const envGuard = requireDevEnvironment();
  if (envGuard) return envGuard;

  const authGuard = await requireAdminRole();
  if (authGuard) return authGuard;

  const override = (await cookies()).get("role_override")?.value ?? "";

  return Response.json({ roleOverride: override });
}

export async function POST(request: Request) {
  const envGuard = requireDevEnvironment();
  if (envGuard) return envGuard;

  const authGuard = await requireAdminRole();
  if (authGuard) return authGuard;

  const body = (await request.json()) as { role?: string };
  const role = String(body?.role ?? "").trim();

  if (!role) {
    return new Response("Role is required", { status: 400 });
  }

  if (!ALLOWED_ROLES.includes(role)) {
    return new Response("Invalid role", { status: 400 });
  }

  const response = Response.json({ roleOverride: role });
  const secure = process.env.NODE_ENV === "production";

  response.headers.set(
    "Set-Cookie",
    `role_override=${role}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400;${secure ? " Secure;" : ""}`,
  );

  return response;
}

export async function DELETE() {
  const envGuard = requireDevEnvironment();
  if (envGuard) return envGuard;

  const authGuard = await requireAdminRole();
  if (authGuard) return authGuard;

  const response = Response.json({ roleOverride: "" });

  response.headers.set(
    "Set-Cookie",
    "role_override=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
  );

  return response;
}
