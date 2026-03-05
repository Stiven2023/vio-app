import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, employees, orders } from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

async function resolveEmployeeId(request: Request) {
  const direct = getEmployeeIdFromRequest(request);

  if (direct) return direct;

  const userId = getUserIdFromRequest(request);

  if (!userId) return null;

  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1);

  return row?.id ?? null;
}

async function resolveAdvisorFilter(request: Request) {
  const role = getRoleFromRequest(request);

  if (role !== "ASESOR") return null;

  const employeeId = await resolveEmployeeId(request);

  if (!employeeId) return "forbidden";

  return employeeId;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "pagos:clients:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PAGO");

  if (forbidden) return forbidden;

  const advisorScope = await resolveAdvisorFilter(request);

  if (advisorScope === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get("q") ?? "").trim();
  const limitRaw = Number(String(searchParams.get("limit") ?? "20"));
  const limit = Number.isFinite(limitRaw)
    ? Math.min(100, Math.max(1, Math.floor(limitRaw)))
    : 20;

  const filters: Array<any> = [
    q
      ? sql`(
          ${clients.clientCode} ilike ${`%${q}%`}
          or ${clients.name} ilike ${`%${q}%`}
          or ${clients.identification} ilike ${`%${q}%`}
        )`
      : undefined,
    advisorScope ? eq(orders.createdBy, advisorScope) : undefined,
  ].filter(Boolean);

  const where = filters.length ? and(...filters) : undefined;

  const query = db
    .select({
      id: clients.id,
      clientCode: clients.clientCode,
      name: clients.name,
      identification: clients.identification,
      email: clients.email,
      lastOrderAt: sql<string | null>`max(${orders.createdAt})`,
      ordersCount: sql<number>`count(distinct ${orders.id})::int`,
    })
    .from(clients)
    .innerJoin(orders, eq(orders.clientId, clients.id))
    .groupBy(clients.id, clients.clientCode, clients.name, clients.identification, clients.email)
    .orderBy(desc(sql`max(${orders.createdAt})`))
    .limit(limit);

  const items = where ? await query.where(where) : await query;

  return Response.json({ items });
}
