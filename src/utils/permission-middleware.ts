import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { roles, permissions, rolePermissions } from "@/src/db/schema";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";

const ROLE_PERMISSION_OVERRIDES: Record<string, string[]> = {
  LIDER_SUMINISTROS: ["VER_PEDIDO", "CAMBIAR_ESTADO_DISEÑO"],
  COMPRA_NACIONAL: ["VER_PEDIDO", "CAMBIAR_ESTADO_DISEÑO"],
  COMPRA_INTERNACIONAL: ["VER_PEDIDO", "CAMBIAR_ESTADO_DISEÑO"],
};

const PERMISSION_ALIASES: Record<string, string[]> = {
  // Proveedores: el seed/roleUseCases usa permisos agregados como GESTIONAR_PROVEEDORES
  VER_PROVEEDOR: ["VER_PROVEEDORES", "GESTIONAR_PROVEEDORES"],
  CREAR_PROVEEDOR: ["GESTIONAR_PROVEEDORES"],
  EDITAR_PROVEEDOR: ["GESTIONAR_PROVEEDORES"],
  ELIMINAR_PROVEEDOR: ["GESTIONAR_PROVEEDORES"],

  // Inventario: algunos roles/config usan nombres distintos
  REGISTRAR_ENTRADA: ["REGISTRAR_ENTRADA_INVENTARIO"],
  REGISTRAR_SALIDA: ["REGISTRAR_SALIDA_INVENTARIO"],

  // Si puedes ver inventario, puedes ver el catálogo de items
  VER_ITEM_INVENTARIO: ["VER_INVENTARIO"],

  // Empaque: mantener compatibilidad con permiso previo MARCAR_EMPAQUE
  CREAR_EMPAQUE: ["MARCAR_EMPAQUE"],
  EDITAR_EMPAQUE: ["MARCAR_EMPAQUE"],
  ELIMINAR_EMPAQUE: ["MARCAR_EMPAQUE"],
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
  const candidates = [
    permissionName,
    ...(PERMISSION_ALIASES[permissionName] ?? []),
  ];
  const uniqueCandidates = Array.from(new Set(candidates));

  for (const candidate of uniqueCandidates) {
    const perm = await db
      .select()
      .from(permissions)
      .where(eq(permissions.name, candidate));

    if (perm.length === 0) continue;

    const hasPerm = await db
      .select()
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, role[0].id),
          eq(rolePermissions.permissionId, perm[0].id),
        ),
      );

    if (hasPerm.length > 0) {
      return null; // autorizado por permiso directo o alias
    }
  }

  return new Response("Forbidden: missing permission", { status: 403 });
}
