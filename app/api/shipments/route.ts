import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clientLegalStatusHistory,
  operativeDashboardLogs,
  orders,
  shipments,
} from "@/src/db/schema";
import { getUserIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

function ensureAuth(request: Request) {
  const userId = getUserIdFromRequest(request);

  if (!userId) {
    return {
      userId: null,
      response: new Response("Unauthorized", { status: 401 }),
    } as const;
  }

  return { userId, response: null } as const;
}

function str(value: unknown) {
  return String(value ?? "").trim();
}

function up(value: unknown) {
  return str(value).toUpperCase();
}

function inferDocumentRef(documentType: "F" | "R" | null) {
  if (documentType === "F") return "RECIBO_CAJA" as const;
  if (documentType === "R") return "PREFACTURA" as const;

  return null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "shipments:get",
    limit: 240,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const auth = ensureAuth(request);

  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const q = str(searchParams.get("q"));

    const where = q
      ? or(
          ilike(shipments.orderCode, `%${q}%`),
          ilike(shipments.designName, `%${q}%`),
          ilike(shipments.size, `%${q}%`),
          ilike(shipments.fromArea, `%${q}%`),
          ilike(shipments.toArea, `%${q}%`),
          ilike(shipments.recipientName, `%${q}%`),
          ilike(shipments.sentBy, `%${q}%`),
        )
      : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(shipments)
      .where(where);

    const items = await db
      .select()
      .from(shipments)
      .where(where)
      .orderBy(desc(shipments.createdAt))
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
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar envíos", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "shipments:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const auth = ensureAuth(request);

  if (auth.response) return auth.response;

  const body = await request.json();

  const mode = up(body.mode) === "CLIENT" ? "CLIENT" : "INTERNAL";
  const fromArea = str(body.fromArea);
  const toArea = str(body.toArea);
  const recipientId = str(body.recipientId) || null;
  const sentBy = str(body.sentBy);
  const recipientName = str(body.recipientName);
  const orderCode = up(body.orderCode);
  const designName = str(body.designName);
  const size = up(body.size);
  const routePath = str(body.routePath);

  if (
    !fromArea ||
    !toArea ||
    !sentBy ||
    !recipientName ||
    !orderCode ||
    !designName ||
    !size ||
    !routePath
  ) {
    return new Response("Faltan campos obligatorios del envío", {
      status: 400,
    });
  }

  if (toArea.toUpperCase() === "CONFECCIONISTA" && !recipientId) {
    return new Response(
      "recipientId es obligatorio cuando el destino es CONFECCIONISTA",
      {
        status: 400,
      },
    );
  }

  let paymentStatus: "PAGADO" | "PENDIENTE" | "NA" = "NA";
  let customerDocumentType: "F" | "R" | null = null;
  let emailMode: "REGISTRADO" | "NUEVO" | "AMBOS" | null = null;
  let emailTo: string | null = null;

  if (mode === "CLIENT") {
    const [orderRow] = await db
      .select({
        id: orders.id,
        clientId: orders.clientId,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.orderCode, orderCode))
      .limit(1);

    if (!orderRow) {
      return new Response("Pedido no encontrado para validar despacho", {
        status: 404,
      });
    }

    if (orderRow.clientId) {
      const [latestLegal] = await db
        .select({ status: clientLegalStatusHistory.status })
        .from(clientLegalStatusHistory)
        .where(eq(clientLegalStatusHistory.clientId, orderRow.clientId))
        .orderBy(desc(clientLegalStatusHistory.createdAt))
        .limit(1);

      const legalStatus = String(latestLegal?.status ?? "");
      const inMontajeOrHigher = [
        "PRODUCCION",
        "ATRASADO",
        "FINALIZADO",
        "ENTREGADO",
      ].includes(String(orderRow.status ?? ""));

      const [progressRow] = await db
        .select({
          totalQty: sql<number>`coalesce(sum(${operativeDashboardLogs.quantityOp}), 0)::int`,
          producedQty: sql<number>`coalesce(sum(${operativeDashboardLogs.producedQuantity}), 0)::int`,
        })
        .from(operativeDashboardLogs)
        .where(eq(operativeDashboardLogs.orderCode, orderCode));

      const totalQty = Number(progressRow?.totalQty ?? 0);
      const producedQty = Number(progressRow?.producedQty ?? 0);
      const progressPercent = totalQty > 0 ? (producedQty / totalQty) * 100 : 0;
      const reachedTwentyPercent = progressPercent >= 20;

      if (
        (legalStatus === "EN_REVISION" || legalStatus === "BLOQUEADO") &&
        !inMontajeOrHigher &&
        !reachedTwentyPercent
      ) {
        return new Response(
          "No se puede despachar: cliente en revisión/bloqueado sin avance mínimo del 20% ni estado de montaje.",
          { status: 422 },
        );
      }
    }

    const paymentInput = up(body.paymentStatus);
    const documentInput = up(body.customerDocumentType);
    const emailModeInput = up(body.emailMode);

    paymentStatus = paymentInput === "PAGADO" ? "PAGADO" : "PENDIENTE";

    if (documentInput !== "F" && documentInput !== "R") {
      return new Response("customerDocumentType debe ser F o R", {
        status: 400,
      });
    }

    customerDocumentType = documentInput as "F" | "R";

    if (!["REGISTRADO", "NUEVO", "AMBOS"].includes(emailModeInput)) {
      return new Response("emailMode inválido", { status: 400 });
    }

    emailMode = emailModeInput as "REGISTRADO" | "NUEVO" | "AMBOS";
    emailTo = str(body.emailTo) || null;

    if ((emailMode === "NUEVO" || emailMode === "AMBOS") && !emailTo) {
      return new Response("emailTo es obligatorio para emailMode NUEVO/AMBOS", {
        status: 400,
      });
    }
  }

  try {
    const created = await db
      .insert(shipments)
      .values({
        mode,
        fromArea,
        toArea,
        recipientId,
        recipientName,
        sentBy,
        orderCode,
        designName,
        size,
        routePath,
        isReceived: false,
        paymentStatus,
        customerDocumentType,
        documentRef: inferDocumentRef(customerDocumentType),
        emailMode,
        emailTo,
        createdByUserId: auth.userId,
      })
      .returning();

    return Response.json(created[0], { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo crear el envío", { status: 500 });
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "shipments:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const auth = ensureAuth(request);

  if (auth.response) return auth.response;

  const body = await request.json();
  const id = str(body.id);

  if (!id) return new Response("id requerido", { status: 400 });

  const markReceived = Boolean(body.markReceived);

  if (!markReceived) {
    return new Response("Solo se permite marcar recibido en esta versión", {
      status: 400,
    });
  }

  try {
    const [current] = await db
      .select({ id: shipments.id, mode: shipments.mode })
      .from(shipments)
      .where(eq(shipments.id, id))
      .limit(1);

    if (!current) return new Response("Envío no encontrado", { status: 404 });

    const [updated] = await db
      .update(shipments)
      .set({
        isReceived: true,
        receivedBy: str(body.receivedBy) || "Recepción interna",
        receivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(shipments.id, id), eq(shipments.mode, "INTERNAL")))
      .returning();

    if (!updated) {
      return new Response(
        "Solo envíos internos pueden marcarse como recibidos",
        {
          status: 400,
        },
      );
    }

    return Response.json(updated);
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo actualizar el envío", { status: 500 });
  }
}
