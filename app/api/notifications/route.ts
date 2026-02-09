import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { notifications } from "@/src/db/schema";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
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

  const roleFromToken = getRoleFromRequest(request);
  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);

  const roleParam = String(searchParams.get("role") ?? "").trim();
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

  const startDate = toStartDate(searchParams.get("startDate"));
  const endDate = toEndDate(searchParams.get("endDate"));
  const unreadOnly = String(searchParams.get("unreadOnly") ?? "").trim();

  const filters = [
    role ? eq(notifications.role, role) : undefined,
    startDate ? gte(notifications.createdAt, startDate) : undefined,
    endDate ? lte(notifications.createdAt, endDate) : undefined,
    unreadOnly === "1" || unreadOnly.toLowerCase() === "true"
      ? eq(notifications.isRead, false)
      : undefined,
  ].filter(Boolean);

  const where = filters.length ? and(...filters) : undefined;

  const totalQuery = db
    .select({ total: sql<number>`count(*)::int` })
    .from(notifications);

  const [{ total }] = where ? await totalQuery.where(where) : await totalQuery;

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
    .where(and(eq(notifications.role, role), eq(notifications.isRead, false)));

  const unreadCount = unreadTotal ?? 0;

  return Response.json({ items, page, pageSize, total, hasNextPage, unreadCount });
}

export async function PATCH(request: Request) {
  const limited = rateLimit(request, {
    key: "notifications:patch",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);

  if (!role) return new Response("Role not found", { status: 403 });

  const body = (await request.json()) as { ids?: string[] };
  const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];

  const where = ids.length
    ? and(eq(notifications.role, role), inArray(notifications.id, ids))
    : eq(notifications.role, role);

  const updated = await db
    .update(notifications)
    .set({ isRead: true })
    .where(where)
    .returning({ id: notifications.id });

  return Response.json({ updated: updated.length });
}
