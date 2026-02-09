import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { roles, permissions, rolePermissions } from "@/src/db/schema";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";

const ROLE_PERMISSION_OVERRIDES: Record<string, string[]> = {
  COMPRAS: ["VER_PEDIDO", "CAMBIAR_ESTADO_DISEÑO"],
};

export async function requirePermission(
  request: Request,
  permissionName: string,
) {
  const roleName = getRoleFromRequest(request);

  if (!roleName) {
    return new Response("Forbidden", { status: 403 });
  }

  // Bypass para administrador: acceso total al panel
  if (roleName === "ADMINISTRADOR") {
    return null;
  }

  const overrides = ROLE_PERMISSION_OVERRIDES[roleName] ?? [];
  if (overrides.includes(permissionName)) {
    return null;
  }

  // Buscar el rol por nombre
  const role = await db.select().from(roles).where(eq(roles.name, roleName));

  if (role.length === 0) {
    return new Response("Forbidden", { status: 403 });
  }
  // Buscar el permiso por nombre
  const perm = await db
    .select()
    .from(permissions)
    .where(eq(permissions.name, permissionName));

  if (perm.length === 0) {
    return new Response("Forbidden", { status: 403 });
  }
  // Verificar si el rol tiene ese permiso
  const hasPerm = await db
    .select()
    .from(rolePermissions)
    .where(
      and(
        eq(rolePermissions.roleId, role[0].id),
        eq(rolePermissions.permissionId, perm[0].id),
      ),
    );

  if (hasPerm.length === 0) {
    return new Response("Forbidden: missing permission", { status: 403 });
  }

  return null; // autorizado
}
