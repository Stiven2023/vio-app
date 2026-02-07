import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { requirePermission } from "@/src/utils/permission-middleware";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "adminUsers:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_USUARIO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(users);
  const items = await db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .limit(pageSize)
    .offset(offset);

  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "adminUsers:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_USUARIO");

  if (forbidden) return forbidden;

  const { id, isActive, emailVerified } = await request.json();

  if (!id || typeof id !== "string" || id.trim() === "") {
    return new Response("User ID required", { status: 400 });
  }

  const updated = await db
    .update(users)
    .set({
      ...(typeof isActive === "boolean" ? { isActive } : {}),
      ...(typeof emailVerified === "boolean" ? { emailVerified } : {}),
    })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  return Response.json(updated);
}
