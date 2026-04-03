import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { notifications } from "@/src/db/erp/schema";
import { dbJsonError, jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import {
  isUnreadOnly,
  notificationsBulkPatchSchema,
  notificationsQuerySchema,
} from "@/src/utils/notifications-contract";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

function toStartDate(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);

  return Number.isNaN(d.getTime()) ? null : d;
}

function toEndDate(value: string | null) {
  if (!value) return null;
  const d = new Date(`${value}T23:59:59.999`);

  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "notifications:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const queryResult = notificationsQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    role: searchParams.get("role") ?? undefined,
    startDate: searchParams.get("startDate") ?? undefined,
    endDate: searchParams.get("endDate") ?? undefined,
    unreadOnly: searchParams.get("unreadOnly") ?? undefined,
  });

  if (!queryResult.success) {
    return zodFirstErrorEnvelope(
      queryResult.error,
      "Parámetros de notificaciones inválidos.",
    );
  }

  const roleFromToken = getRoleFromRequest(request);
  const { page, pageSize, offset } = parsePagination(searchParams);

  const roleParam = queryResult.data.role ?? "";
  const isAdmin = roleFromToken === "ADMINISTRADOR";
  const role = isAdmin && roleParam ? roleParam : roleFromToken;

  if (!role) {
    return Response.json({
      items: [],
      page,
      pageSize,
      total: 0,
      hasNextPage: false,
      unreadCount: 0,
    });
  }

  const startDate = toStartDate(queryResult.data.startDate ?? null);
  const endDate = toEndDate(queryResult.data.endDate ?? null);

  const filters = [
    role ? eq(notifications.role, role) : undefined,
    startDate ? gte(notifications.createdAt, startDate) : undefined,
    endDate ? lte(notifications.createdAt, endDate) : undefined,
    isUnreadOnly(queryResult.data.unreadOnly)
      ? eq(notifications.isRead, false)
      : undefined,
  ].filter(Boolean);

  const where = filters.length ? and(...filters) : undefined;

  try {
    const totalQuery = db
      .select({ total: sql<number>`count(*)::int` })
      .from(notifications);

    const [{ total }] = where
      ? await totalQuery.where(where)
      : await totalQuery;

    const itemsQuery = db
      .select({
        id: notifications.id,
        title: notifications.title,
        message: notifications.message,
        role: notifications.role,
        href: notifications.href,
        isRead: notifications.isRead,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items = where ? await itemsQuery.where(where) : await itemsQuery;
    const hasNextPage = offset + items.length < total;

    const [{ total: unreadTotal }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(eq(notifications.role, role), eq(notifications.isRead, false)),
      );

    const unreadCount = unreadTotal ?? 0;

    return Response.json({
      items,
      page,
      pageSize,
      total,
      hasNextPage,
      unreadCount,
    });
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudo consultar notificaciones.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo consultar notificaciones.",
    );
  }
}

export async function PATCH(request: Request) {
  const limited = rateLimit(request, {
    key: "notifications:patch",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);

  if (!role) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para ver notificaciones.");
  }

  const body = (await request.json().catch(() => null)) as unknown;

  if (body === null) {
    return jsonError(400, "INVALID_JSON", "El cuerpo JSON es inválido.");
  }

  const parseResult = notificationsBulkPatchSchema.safeParse(body);

  if (!parseResult.success) {
    return zodFirstErrorEnvelope(
      parseResult.error,
      "Datos de notificaciones inválidos.",
    );
  }

  const ids = Array.isArray(parseResult.data.ids)
    ? parseResult.data.ids.filter(Boolean)
    : [];

  const where = ids.length
    ? and(eq(notifications.role, role), inArray(notifications.id, ids))
    : eq(notifications.role, role);

  try {
    const updated = await db
      .update(notifications)
      .set({ isRead: true })
      .where(where)
      .returning({ id: notifications.id });

    return Response.json({ updated: updated.length });
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudieron actualizar notificaciones.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudieron actualizar notificaciones.",
    );
  }
}
