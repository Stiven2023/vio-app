import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { notifications, permissions, rolePermissions, roles } from "@/src/db/schema";

type NotificationPayload = {
  title: string;
  message: string;
  href?: string | null;
};

async function getRolesForPermission(permissionName: string) {
  const rows = await db
    .select({ name: roles.name })
    .from(roles)
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(permissions.name, permissionName));

  return rows.map((r) => r.name).filter(Boolean) as string[];
}

export async function createNotificationsForPermission(
  permissionName: string,
  payload: NotificationPayload,
) {
  const roleNames = await getRolesForPermission(permissionName);

  if (roleNames.length === 0) return;

  await db.insert(notifications).values(
    roleNames.map((role) => ({
      title: payload.title,
      message: payload.message,
      role,
      href: payload.href ?? null,
      isRead: false,
    })),
  );
}
