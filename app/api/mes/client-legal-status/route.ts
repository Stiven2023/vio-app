import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { clientLegalStatus, clients } from "@/src/db/schema";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

const READ_ROLES = new Set([
  "ADMINISTRADOR",
  "LIDER_JURIDICA",
  "LIDER_OPERACIONAL",
  "OPERARIO_DESPACHO",
  "PROGRAMACION",
]);

const WRITE_ROLES = new Set(["ADMINISTRADOR", "LIDER_JURIDICA"]);

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:client-legal-status:get",
    limit: 200,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const role = getRoleFromRequest(request);
  if (!role || !READ_ROLES.has(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const search = String(searchParams.get("search") ?? "").trim().toLowerCase();

    const baseQuery = db
      .select({
        id: clientLegalStatus.id,
        clientId: clientLegalStatus.clientId,
        isLegallyEnabled: clientLegalStatus.isLegallyEnabled,
        legalNotes: clientLegalStatus.legalNotes,
        enabledAt: clientLegalStatus.enabledAt,
        disabledAt: clientLegalStatus.disabledAt,
        updatedAt: clientLegalStatus.updatedAt,
        clientName: clients.name,
        clientCode: clients.clientCode,
      })
      .from(clientLegalStatus)
      .innerJoin(clients, eq(clientLegalStatus.clientId, clients.id));

    const withFilter = search
      ? baseQuery.where(
          sql`lower(${clients.name}) like ${"%" + search + "%"}`,
        )
      : baseQuery;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(clientLegalStatus)
      .innerJoin(clients, eq(clientLegalStatus.clientId, clients.id))
      .where(
        search
          ? sql`lower(${clients.name}) like ${"%" + search + "%"}`
          : sql`1=1`,
      );

    const items = await withFilter
      .orderBy(asc(clients.name))
      .limit(pageSize)
      .offset(offset);

    return Response.json({
      items,
      page,
      pageSize,
      total,
      hasNextPage: offset + items.length < total,
    });
  } catch (error) {
    const resp = dbErrorResponse(error);
    if (resp) return resp;
    return new Response("Error al consultar estado jurídico de clientes", { status: 500 });
  }
}
