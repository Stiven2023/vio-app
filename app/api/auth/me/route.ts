import { NextResponse } from "next/server";

import {
  getAuthFromRequest,
  resolveSessionFromRequest,
} from "@/src/utils/auth-middleware";
import { jsonError } from "@/src/utils/api-error";
import { resolveEmployeeIdentity } from "@/src/utils/employee-session";
import { resolveEmployeeRole } from "@/src/utils/employee-session";

export async function GET(request: Request) {
  const payload = getAuthFromRequest(request);
  const session = resolveSessionFromRequest(request, { preferMesSession: true });
  const mesAccess = session.mesAccess;

  if ((!payload || typeof payload !== "object") && !mesAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;
  const employeeId = session.employeeId;
  const email = session.email;

  const employee = await resolveEmployeeIdentity({
    employeeId,
    userId,
    email,
  });

  const avatarUrl = employee?.employeeImageUrl ?? null;
  const employeeName = employee?.name ?? null;

  const typedPayload = (payload ?? {}) as {
    userId?: string;
    name?: string;
    role?: string;
    email?: string;
  };
  const roleResolution = resolveEmployeeRole(employee, session.role);
  const isMesSession = session.sessionType === "mes";

  if (!isMesSession && roleResolution.code) {
    return jsonError(
      409,
      "AUTH_ROLE_NOT_CONFIGURED",
      "La sesión no tiene un rol válido porque el empleado asociado no está configurado correctamente.",
    );
  }

  const effectiveRole = roleResolution.role;
  const effectiveEmail = email ?? employee?.email ?? typedPayload.email ?? null;
  const effectiveEmployeeId = employee?.id ?? employeeId ?? null;

  const user = {
    id: typedPayload.userId ?? mesAccess?.userId ?? null,
    name: employeeName ?? mesAccess?.employeeName ?? typedPayload.name ?? null,
    role: effectiveRole,
    email: effectiveEmail,
    employeeId: effectiveEmployeeId,
    sessionType: session.sessionType ?? "auth",
    mesAccess: mesAccess
      ? {
          role: mesAccess.role,
          processKey: mesAccess.processKey,
          mesProcess: mesAccess.mesProcess,
          operationType: mesAccess.operationType,
          machineId: mesAccess.machineId,
          machineName: mesAccess.machineName,
        }
      : null,
    avatarUrl,
  };

  return NextResponse.json({ user });
}
