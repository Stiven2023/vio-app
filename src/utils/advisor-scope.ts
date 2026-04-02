import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { employees, orders } from "@/src/db/erp/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";

export async function resolveAdvisorEmployeeId(request: Request) {
  const role = getRoleFromRequest(request);

  if (role !== "ASESOR") return null;

  const direct = getEmployeeIdFromRequest(request);

  if (direct) return direct;

  const userId = getUserIdFromRequest(request);

  if (!userId) return "forbidden" as const;

  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1);

  return row?.id ?? ("forbidden" as const);
}

export async function advisorWhereScope(request: Request, ownerColumn: any) {
  const advisorEmployeeId = await resolveAdvisorEmployeeId(request);

  if (advisorEmployeeId === "forbidden") return "forbidden" as const;
  if (!advisorEmployeeId) return null;

  return eq(ownerColumn, advisorEmployeeId);
}

export async function assertAdvisorOwnsOrder(
  request: Request,
  orderId: string,
) {
  const advisorEmployeeId = await resolveAdvisorEmployeeId(request);

  if (advisorEmployeeId === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }

  if (!advisorEmployeeId) return null;

  const [row] = await db
    .select({ createdBy: orders.createdBy })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  if (row.createdBy !== advisorEmployeeId) {
    return new Response("Forbidden", { status: 403 });
  }

  return null;
}
