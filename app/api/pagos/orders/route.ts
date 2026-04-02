import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, employees, orders } from "@/src/db/erp/schema";
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
    key: "pagos:orders:get",
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
  const clientId = String(searchParams.get("clientId") ?? "").trim();
  const limitRaw = Number(String(searchParams.get("limit") ?? "20"));
  const limit = Number.isFinite(limitRaw)
    ? Math.min(100, Math.max(1, Math.floor(limitRaw)))
    : 20;

  const filters: Array<any> = [
    q
      ? sql`(
          ${orders.orderCode} ilike ${`%${q}%`}
          or ${clients.clientCode} ilike ${`%${q}%`}
          or ${clients.name} ilike ${`%${q}%`}
        )`
      : undefined,
    advisorScope ? eq(orders.createdBy, advisorScope) : undefined,
    clientId ? eq(orders.clientId, clientId) : undefined,
  ].filter(Boolean);

  const where = filters.length ? and(...filters) : undefined;

  const query = db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      clientId: orders.clientId,
      clientName: clients.name,
      clientCode: clients.clientCode,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .orderBy(desc(orders.createdAt))
    .limit(limit);

  const items = where ? await query.where(where) : await query;

  return Response.json({ items });
}
