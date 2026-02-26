import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  employees,
  orders,
  prefacturas,
  quotations,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

async function resolveAdvisorFilter(request: Request) {
  const role = getRoleFromRequest(request);

  if (role !== "ASESOR") return null;

  const employeeId = getEmployeeIdFromRequest(request);

  if (!employeeId) return "forbidden";

  return employeeId;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "prefacturas:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");
  if (forbidden) return forbidden;

  const advisorScope = await resolveAdvisorFilter(request);
  if (advisorScope === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const q = String(searchParams.get("q") ?? "").trim();
    const status = String(searchParams.get("status") ?? "all").trim().toUpperCase();
    const type = String(searchParams.get("type") ?? "all").trim().toUpperCase();
    const orderStatus = String(searchParams.get("orderStatus") ?? "all").trim().toUpperCase();

    const filters = [] as Array<any>;

    if (status && status !== "ALL") {
      filters.push(eq(prefacturas.status, status));
    }

    if (type === "VN" || type === "VI") {
      filters.push(eq(orders.type, type as "VN" | "VI"));
    }

    if (orderStatus && orderStatus !== "ALL") {
      filters.push(eq(orders.status, orderStatus as any));
    }

    if (advisorScope) {
      filters.push(eq(orders.createdBy, advisorScope));
    }

    if (q) {
      filters.push(
        or(
          ilike(prefacturas.prefacturaCode, `%${q}%`),
          ilike(quotations.quoteCode, `%${q}%`),
          ilike(orders.orderCode, `%${q}%`),
          ilike(orders.orderName, `%${q}%`),
          ilike(clients.name, `%${q}%`),
        ),
      );
    }

    const whereClause = filters.length ? and(...filters) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(distinct ${prefacturas.id})::int` })
      .from(prefacturas)
      .leftJoin(quotations, eq(prefacturas.quotationId, quotations.id))
      .leftJoin(orders, eq(prefacturas.orderId, orders.id))
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .where(whereClause);

    const items = await db
      .select({
        id: prefacturas.id,
        prefacturaCode: prefacturas.prefacturaCode,
        quotationId: prefacturas.quotationId,
        quoteCode: quotations.quoteCode,
        orderId: prefacturas.orderId,
        orderCode: orders.orderCode,
        orderName: orders.orderName,
        orderType: orders.type,
        status: prefacturas.status,
        totalProducts: prefacturas.totalProducts,
        subtotal: prefacturas.subtotal,
        total: prefacturas.total,
        clientName: sql<string | null>`coalesce(${clients.name}, (select c2.name from clients c2 where c2.id = ${quotations.clientId}))`,
        approvedAt: prefacturas.approvedAt,
        createdAt: prefacturas.createdAt,
      })
      .from(prefacturas)
      .leftJoin(quotations, eq(prefacturas.quotationId, quotations.id))
      .leftJoin(orders, eq(prefacturas.orderId, orders.id))
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .where(whereClause)
      .orderBy(desc(prefacturas.createdAt))
      .limit(pageSize)
      .offset(offset);

    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudieron consultar prefacturas", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "prefacturas:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PEDIDO");
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const quotationIdRaw = String(body?.quotationId ?? "").trim();
    const quotationCodeRaw = String(body?.quotationCode ?? "").trim();
    const orderName = String(body?.orderName ?? "").trim();
    const orderType = String(body?.orderType ?? "").trim().toUpperCase();

    let quotationId = quotationIdRaw;

    if (!quotationId && quotationCodeRaw) {
      const [quote] = await db
        .select({ id: quotations.id })
        .from(quotations)
        .where(eq(quotations.quoteCode, quotationCodeRaw))
        .limit(1);

      quotationId = String(quote?.id ?? "").trim();
    }

    if (!quotationId) {
      return new Response("quotationId o quotationCode requerido", {
        status: 400,
      });
    }

    const origin = new URL(request.url).origin;
    const proxyResponse = await fetch(`${origin}/api/quotations/${quotationId}/prefactura`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        orderName,
        orderType: orderType === "VI" ? "VI" : "VN",
      }),
      cache: "no-store",
    });

    const contentType = proxyResponse.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await proxyResponse.json();
      return Response.json(payload, { status: proxyResponse.status });
    }

    const text = await proxyResponse.text();
    return new Response(text, { status: proxyResponse.status });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo crear prefactura", { status: 500 });
  }
}
