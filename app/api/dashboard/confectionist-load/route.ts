import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { confectionists, orderItemConfection } from "@/src/db/schema";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "dashboard:confectionist-load",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);
  if (!role) return new Response("Unauthorized", { status: 401 });

  if (role !== "OPERARIO_INTEGRACION" && role !== "ADMINISTRADOR" && role !== "LIDER_DE_PROCESOS") {
    return new Response("Forbidden", { status: 403 });
  }

  const rows = await db
    .select({
      id: confectionists.id,
      name: confectionists.name,
      activeCount: sql<number>`count(${orderItemConfection.id})::int`,
      latestAssigned: sql<string | null>`max(${orderItemConfection.assignedAt})::text`,
    })
    .from(confectionists)
    .leftJoin(
      orderItemConfection,
      and(
        eq(orderItemConfection.confectionistId, confectionists.id),
        isNull(orderItemConfection.finishedAt),
      ),
    )
    .groupBy(confectionists.id)
    .orderBy(desc(sql`count(${orderItemConfection.id})`));

  return Response.json({ items: rows });
}
