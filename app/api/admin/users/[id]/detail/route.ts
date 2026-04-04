import { eq } from "drizzle-orm";

import { erpDb, iamDb } from "@/src/db";
import { employees } from "@/src/db/erp/schema";
import { roles, users } from "@/src/db/iam/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "adminUsers:detail:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_USUARIO");

  if (forbidden) return forbidden;

  const { id } = await context.params;

  if (!id) {
    return new Response("User ID required", { status: 400 });
  }

  const userRows = await iamDb
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      emailVerified: users.emailVerified,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (userRows.length === 0) {
    return new Response("Usuario no encontrado", { status: 404 });
  }

  const user = userRows[0];

  const employeeRows = await erpDb
    .select()
    .from(employees)
    .where(eq(employees.userId, user.id))
    .limit(1);

  const employee = employeeRows[0] ?? null;

  const roleRows = employee?.roleId
    ? await iamDb
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(eq(roles.id, employee.roleId))
        .limit(1)
    : [];

  return Response.json({
    user,
    employee,
    role: roleRows[0] ?? null,
  });
}
