import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { employees } from "@/src/db/schema";
import {
  getAuthFromRequest,
  getEmployeeIdFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";

export async function GET(request: Request) {
  const payload = getAuthFromRequest(request);

  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = getUserIdFromRequest(request);
  const employeeId = getEmployeeIdFromRequest(request);

  let avatarUrl: string | null = null;
  let employeeName: string | null = null;

  if (employeeId) {
    const [employee] = await db
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
    const [employee] = await db
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

  const typedPayload = payload as {
    userId?: string;
    name?: string;
    role?: string;
  };

  const user = {
    id: typedPayload.userId ?? null,
    name: employeeName ?? typedPayload.name ?? null,
    role: typedPayload.role ?? null,
    avatarUrl,
  };

  return NextResponse.json({ user });
}
