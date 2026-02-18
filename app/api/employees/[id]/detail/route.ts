import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { employees, users } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "employees:detail:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_EMPLEADO");

  if (forbidden) return forbidden;

  const { id } = await context.params;

  if (!id) {
    return new Response("Employee ID required", { status: 400 });
  }

  const employeeRows = await db
    .select()
    .from(employees)
    .where(eq(employees.id, id))
    .limit(1);

  if (employeeRows.length === 0) {
    return new Response("Empleado no encontrado", { status: 404 });
  }

  const employee = employeeRows[0];

  const userRows = employee.userId
    ? await db
        .select({
          id: users.id,
          email: users.email,
          emailVerified: users.emailVerified,
          isActive: users.isActive,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, employee.userId))
        .limit(1)
    : [];

  return Response.json({
    employee,
    user: userRows[0] ?? null,
  });
}
