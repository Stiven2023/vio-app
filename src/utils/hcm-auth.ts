import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { employees } from "@/src/db/erp/schema";
import {
  getEmployeeIdFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { jsonError } from "@/src/utils/api-error";

export async function resolveEmployeeIdFromRequest(request: Request) {
  const direct = getEmployeeIdFromRequest(request);

  if (direct) return direct;

  const userId = getUserIdFromRequest(request);

  if (!userId) return null;

  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1);

  return employee?.id ?? null;
}

export function denyIfNotSelf(requestedEmployeeId: string, authEmployeeId: string) {
  if (requestedEmployeeId === authEmployeeId) return null;

  return jsonError(403, "FORBIDDEN", "No tienes permisos para consultar recursos de otro empleado.");
}
