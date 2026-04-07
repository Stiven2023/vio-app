import { and, eq, inArray } from "drizzle-orm";

import { iamDb } from "@/src/db";
import { permissions, rolePermissions, roles, users } from "@/src/db/iam/schema";
import {
  getRoleFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";

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

  // Juridica por entidad (compatibilidad con permisos de vista/edicion actuales)
  VER_ESTADO_JURIDICO_EMPLEADO: ["VER_EMPLEADO"],
  CAMBIAR_ESTADO_JURIDICO_EMPLEADO: ["EDITAR_EMPLEADO"],

  VER_ESTADO_JURIDICO_PROVEEDOR: [
    "VER_PROVEEDOR",
    "VER_PROVEEDORES",
    "GESTIONAR_PROVEEDORES",
  ],
  CAMBIAR_ESTADO_JURIDICO_PROVEEDOR: [
    "EDITAR_PROVEEDOR",
    "GESTIONAR_PROVEEDORES",
  ],

  VER_ESTADO_JURIDICO_CONFECCIONISTA: ["VER_CONFECCIONISTA"],
  CAMBIAR_ESTADO_JURIDICO_CONFECCIONISTA: ["EDITAR_CONFECCIONISTA"],

  VER_ESTADO_JURIDICO_EMPAQUE: ["VER_EMPAQUE", "MARCAR_EMPAQUE"],
  CAMBIAR_ESTADO_JURIDICO_EMPAQUE: ["EDITAR_EMPAQUE", "MARCAR_EMPAQUE"],
};

async function isUserActive(userId: string | null): Promise<boolean> {
  if (!userId) return false;

  const rows = await iamDb
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, true)))
    .limit(1);

  return rows.length > 0;
}

export async function checkPermissionsByRole(
  roleName: string | null,
  permissionNames: string[],
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};

  for (const name of permissionNames) result[name] = false;

  if (!roleName) return result;

  if (roleName === "ADMINISTRADOR") {
    for (const name of permissionNames) result[name] = true;

    return result;
  }

  const overrides = ROLE_PERMISSION_OVERRIDES[roleName] ?? [];
  const candidateToOriginal = new Map<string, string>();

  for (const name of permissionNames) {
    if (overrides.includes(name)) {
      result[name] = true;
      continue;
    }

    const candidates = Array.from(
      new Set([name, ...(PERMISSION_ALIASES[name] ?? [])]),
    );

    for (const candidate of candidates) {
      candidateToOriginal.set(candidate, name);
    }
  }

  if (candidateToOriginal.size === 0) return result;

  const rows = await iamDb
    .select({ permName: permissions.name })
    .from(rolePermissions)
    .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        eq(roles.name, roleName),
        inArray(permissions.name, Array.from(candidateToOriginal.keys())),
      ),
    );

  for (const row of rows) {
    const original = candidateToOriginal.get(row.permName);

    if (original) result[original] = true;
  }

  return result;
}

export async function requirePermission(
  request: Request,
  permissionName: string,
) {
  const roleName = getRoleFromRequest(request);
  const userId = getUserIdFromRequest(request);

  if (!roleName) {
    return new Response("Access denied", { status: 403 });
  }

  // Verify the user still exists and is active in IAM DB
  const userActive = await isUserActive(userId);

  if (!userActive) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", code: "USER_NOT_FOUND" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // Bypass para administrador: acceso total al panel
  if (roleName === "ADMINISTRADOR") {
    return null;
  }

  const overrides = ROLE_PERMISSION_OVERRIDES[roleName] ?? [];

  if (overrides.includes(permissionName)) {
    return null;
  }

  const candidates = Array.from(
    new Set([permissionName, ...(PERMISSION_ALIASES[permissionName] ?? [])]),
  );

  // Single JOIN query: roles → role_permissions → permissions
  const rows = await iamDb
    .select({ permId: rolePermissions.permissionId })
    .from(rolePermissions)
    .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(roles.name, roleName), inArray(permissions.name, candidates)))
    .limit(1);

  return rows.length > 0
    ? null
    : new Response("Access denied: missing permission", { status: 403 });
}

/**
 * Checks multiple permissions at once with a single DB query.
 * Returns a map of permissionName → boolean (true = granted).
 * Use this instead of calling requirePermission() in a loop.
 */
export async function checkPermissions(
  request: Request,
  permissionNames: string[],
): Promise<Record<string, boolean>> {
  const roleName = getRoleFromRequest(request);

  return checkPermissionsByRole(roleName, permissionNames);
}
