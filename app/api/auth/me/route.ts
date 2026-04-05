import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { erpDb } from "@/src/db";
import { employees } from "@/src/db/erp/schema";
import {
  getAuthFromRequest,
  getEmailFromRequest,
  getEmployeeIdFromRequest,
  getMesAccessFromRequest,
  getRoleFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";

export async function GET(request: Request) {
  const payload = getAuthFromRequest(request);
  const mesAccess = getMesAccessFromRequest(request);

  if ((!payload || typeof payload !== "object") && !mesAccess) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = getUserIdFromRequest(request);
  const employeeId = getEmployeeIdFromRequest(request);
  const email = getEmailFromRequest(request);
  const role = getRoleFromRequest(request);

  let avatarUrl: string | null = null;
  let employeeName: string | null = null;

  if (employeeId) {
    const [employee] = await erpDb
      .select({
        name: employees.name,
        employeeImageUrl: employees.employeeImageUrl,
      })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);

    avatarUrl = employee?.employeeImageUrl ?? null;
    employeeName = employee?.name ?? null;
  } else if (userId) {
    const [employee] = await erpDb
      .select({
        name: employees.name,
        employeeImageUrl: employees.employeeImageUrl,
      })
      .from(employees)
      .where(eq(employees.userId, userId))
      .limit(1);

    avatarUrl = employee?.employeeImageUrl ?? null;
    employeeName = employee?.name ?? null;
  }

  const typedPayload = (payload ?? {}) as {
    userId?: string;
    name?: string;
    role?: string;
  };

  const user = {
    id: typedPayload.userId ?? mesAccess?.userId ?? null,
    name: employeeName ?? mesAccess?.employeeName ?? typedPayload.name ?? null,
    role: role ?? null,
    email,
    employeeId,
    sessionType: mesAccess ? "mes" : "auth",
    mesAccess: mesAccess
      ? {
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
