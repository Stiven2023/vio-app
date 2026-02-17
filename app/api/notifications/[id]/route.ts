import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { notifications } from "@/src/db/schema";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "notifications:patch-one",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_NOTIFICACION");

  if (forbidden) return forbidden;

  const role = getRoleFromRequest(request);

  if (!role) return new Response("Role not found", { status: 403 });

  const { id } = await params;
  const nid = String(id ?? "").trim();

  if (!nid) return new Response("id required", { status: 400 });

  try {
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, nid), eq(notifications.role, role)))
      .returning({ id: notifications.id });

    if (!updated) return new Response("Not found", { status: 404 });

    return Response.json(updated);
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo actualizar notificacion", {
      status: 500,
    });
  }
}
