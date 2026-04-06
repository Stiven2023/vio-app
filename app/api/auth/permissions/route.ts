import { NextResponse } from "next/server";

import { jsonError } from "@/src/utils/api-error";
import { resolveSessionFromRequest } from "@/src/utils/auth-middleware";
import {
  resolveEmployeeIdentity,
  resolveEmployeeRole,
} from "@/src/utils/employee-session";
import { checkPermissionsByRole } from "@/src/utils/permission-middleware";

export async function GET(request: Request) {
  const session = resolveSessionFromRequest(request, { preferMesSession: true });

  if (!session.auth && !session.mesAccess) {
    return jsonError(401, "UNAUTHENTICATED", "Debes iniciar sesión para consultar permisos.");
  }

  const employee = await resolveEmployeeIdentity({
    employeeId: session.employeeId,
    userId: session.userId,
    email: session.email,
  });
  const roleResolution = resolveEmployeeRole(employee, session.role);

  if (roleResolution.code) {
    return jsonError(
      409,
      "AUTH_ROLE_NOT_CONFIGURED",
      "La sesión no tiene un rol válido para resolver permisos.",
    );
  }

  const { searchParams } = new URL(request.url);
  const raw = String(searchParams.get("names") ?? "").trim();

  if (!raw) {
    return NextResponse.json({ permissions: {} });
  }

  const names = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const result = await checkPermissionsByRole(roleResolution.role, names);

  return NextResponse.json({ permissions: result });
}
