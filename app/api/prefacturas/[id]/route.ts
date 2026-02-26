import { and, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
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
import { rateLimit } from "@/src/utils/rate-limit";

async function resolveAdvisorFilter(request: Request) {
  const role = getRoleFromRequest(request);

  if (role !== "ASESOR") return null;

  const employeeId = getEmployeeIdFromRequest(request);

  if (!employeeId) return "forbidden";

  return employeeId;
}

async function getPrefacturaById(id: string, advisorScope: string | null) {
  const filters = [eq(prefacturas.id, id)] as Array<any>;

  if (advisorScope) {
    filters.push(eq(orders.createdBy, advisorScope));
  }

  const [row] = await db
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
    .where(and(...filters))
    .limit(1);

  return row ?? null;
}

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "prefacturas:get:id",
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

  const prefacturaId = String(params.id ?? "").trim();
  if (!prefacturaId) return new Response("id required", { status: 400 });

  try {
    const row = await getPrefacturaById(prefacturaId, advisorScope);

    if (!row) {
      return new Response("Prefactura no encontrada", { status: 404 });
    }

    return Response.json(row);
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar la prefactura", { status: 500 });
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "prefacturas:put:id",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");
  if (forbidden) return forbidden;

  const advisorScope = await resolveAdvisorFilter(request);
  if (advisorScope === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }

  const prefacturaId = String(params.id ?? "").trim();
  if (!prefacturaId) return new Response("id required", { status: 400 });

  try {
    const body = await request.json();
    const orderName = String(body?.orderName ?? "").trim();
    const orderType = String(body?.orderType ?? "").trim().toUpperCase();
    const status = String(body?.status ?? "").trim().toUpperCase();

    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: prefacturas.id,
          quotationId: prefacturas.quotationId,
          orderId: prefacturas.orderId,
          orderCreatedBy: orders.createdBy,
        })
        .from(prefacturas)
        .leftJoin(orders, eq(prefacturas.orderId, orders.id))
        .where(eq(prefacturas.id, prefacturaId))
        .limit(1);

      if (!current) return null;

      if (advisorScope && current.orderCreatedBy !== advisorScope) {
        throw new Error("forbidden");
      }

      if (status) {
        await tx
          .update(prefacturas)
          .set({ status })
          .where(eq(prefacturas.id, prefacturaId));

        await tx
          .update(quotations)
          .set({
            prefacturaApproved: status === "APROBADA",
            updatedAt: new Date(),
          })
          .where(eq(quotations.id, String(current.quotationId)));
      }

      if (current.orderId && (orderName || orderType === "VN" || orderType === "VI")) {
        await tx
          .update(orders)
          .set({
            orderName: orderName || undefined,
            type: orderType === "VI" ? ("VI" as any) : orderType === "VN" ? ("VN" as any) : undefined,
          })
          .where(eq(orders.id, String(current.orderId)));
      }

      return current;
    });

    if (!updated) {
      return new Response("Prefactura no encontrada", { status: 404 });
    }

    const row = await getPrefacturaById(prefacturaId, advisorScope || null);
    if (!row) {
      return new Response("Prefactura no encontrada", { status: 404 });
    }

    return Response.json(row);
  } catch (error) {
    if ((error as Error)?.message === "forbidden") {
      return new Response("Forbidden", { status: 403 });
    }

    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo actualizar la prefactura", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "prefacturas:delete:id",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_PEDIDO");
  if (forbidden) return forbidden;

  const advisorScope = await resolveAdvisorFilter(request);
  if (advisorScope === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }

  const prefacturaId = String(params.id ?? "").trim();
  if (!prefacturaId) return new Response("id required", { status: 400 });

  try {
    const deleted = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: prefacturas.id,
          quotationId: prefacturas.quotationId,
          orderCreatedBy: orders.createdBy,
        })
        .from(prefacturas)
        .leftJoin(orders, eq(prefacturas.orderId, orders.id))
        .where(eq(prefacturas.id, prefacturaId))
        .limit(1);

      if (!current) return null;

      if (advisorScope && current.orderCreatedBy !== advisorScope) {
        throw new Error("forbidden");
      }

      await tx.delete(prefacturas).where(eq(prefacturas.id, prefacturaId));

      await tx
        .update(quotations)
        .set({ prefacturaApproved: false, updatedAt: new Date() })
        .where(eq(quotations.id, String(current.quotationId)));

      return current;
    });

    if (!deleted) {
      return new Response("Prefactura no encontrada", { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    if ((error as Error)?.message === "forbidden") {
      return new Response("Forbidden", { status: 403 });
    }

    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo eliminar la prefactura", { status: 500 });
  }
}
