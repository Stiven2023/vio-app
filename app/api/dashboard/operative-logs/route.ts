import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  operativeDashboardLogs,
  orderItemPackaging,
  orderItemSocks,
  orderItemStatusHistory,
  orderItems,
  orders,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

const ROLE_AREAS = ["OPERARIOS", "CONFECCIONISTAS", "MENSAJERIA", "EMPAQUE"] as const;
const OPERATION_TYPES = [
  "PLOTTER",
  "CALANDRA",
  "CORTE_LASER",
  "CORTE_MANUAL",
  "INTEGRACION",
  "DESPACHO",
] as const;
const PROCESS_CODES = ["P", "S", "C"] as const;

const ORDER_ITEM_STATUS_FLOW = [
  "PENDIENTE",
  "REVISION_ADMIN",
  "APROBACION_INICIAL",
  "PENDIENTE_PRODUCCION",
  "EN_MONTAJE",
  "EN_IMPRESION",
  "SUBLIMACION",
  "CORTE_MANUAL",
  "CORTE_LASER",
  "PENDIENTE_CONFECCION",
  "CONFECCION",
  "EN_BODEGA",
  "EMPAQUE",
  "ENVIADO",
  "COMPLETADO",
] as const;

type OrderItemStatus =
  | "PENDIENTE"
  | "REVISION_ADMIN"
  | "APROBACION_INICIAL"
  | "PENDIENTE_PRODUCCION"
  | "EN_MONTAJE"
  | "EN_IMPRESION"
  | "SUBLIMACION"
  | "CORTE_MANUAL"
  | "CORTE_LASER"
  | "PENDIENTE_CONFECCION"
  | "CONFECCION"
  | "EN_BODEGA"
  | "EMPAQUE"
  | "ENVIADO"
  | "EN_REVISION_CAMBIO"
  | "APROBADO_CAMBIO"
  | "RECHAZADO_CAMBIO"
  | "COMPLETADO"
  | "CANCELADO";

const NEXT_STATUS_BY_OPERATION: Record<
  (typeof OPERATION_TYPES)[number],
  OrderItemStatus
> = {
  PLOTTER: "EN_IMPRESION",
  CALANDRA: "CORTE_MANUAL",
  CORTE_LASER: "PENDIENTE_CONFECCION",
  CORTE_MANUAL: "PENDIENTE_CONFECCION",
  INTEGRACION: "EN_BODEGA",
  DESPACHO: "ENVIADO",
};

const DASHBOARD_ROLES = new Set([
  "ADMINISTRADOR",
  "EMPAQUE",
  "CONFECCIONISTA",
  "MENSAJERO",
  "OPERARIO_BODEGA",
  "OPERARIO_INTEGRACION_CALIDAD",
  "OPERARIO_CORTE_LASER",
  "OPERARIO_CORTE_MANUAL",
  "OPERARIO_FLOTER",
  "OPERARIO_DESPACHO",
  "OPERARIO_MONTAJE",
  "OPERARIO_SUBLIMACION",
]);

function normalizeRoleArea(v: unknown) {
  const raw = String(v ?? "").trim().toUpperCase();
  if (ROLE_AREAS.includes(raw as (typeof ROLE_AREAS)[number])) {
    return raw as (typeof ROLE_AREAS)[number];
  }
  return null;
}

function normalizeOperationType(v: unknown) {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const raw = String(v ?? "").trim().toUpperCase();
  if (OPERATION_TYPES.includes(raw as (typeof OPERATION_TYPES)[number])) {
    return raw as (typeof OPERATION_TYPES)[number];
  }
  return null;
}

function normalizeProcessCode(v: unknown) {
  const raw = String(v ?? "").trim().toUpperCase();
  if (PROCESS_CODES.includes(raw as (typeof PROCESS_CODES)[number])) {
    return raw as (typeof PROCESS_CODES)[number];
  }
  return null;
}

function parseNonNegativeInt(v: unknown) {
  const n = Number(String(v ?? "0").trim());
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

function parseDateTime(v: unknown) {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const date = new Date(String(v));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toOptionalText(v: unknown) {
  if (v === null || v === undefined) return null;
  const text = String(v).trim();
  return text ? text : null;
}

function toBoolean(v: unknown) {
  if (typeof v === "boolean") return v;
  const raw = String(v ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "si" || raw === "sí";
}

function normalizeMatchText(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function shouldMoveForward(current: string | null, next: OrderItemStatus) {
  if (!current) return true;

  const currentIndex = ORDER_ITEM_STATUS_FLOW.indexOf(current as (typeof ORDER_ITEM_STATUS_FLOW)[number]);
  const nextIndex = ORDER_ITEM_STATUS_FLOW.indexOf(next as (typeof ORDER_ITEM_STATUS_FLOW)[number]);

  if (nextIndex < 0) return false;
  if (currentIndex < 0) return true;

  return nextIndex > currentIndex;
}

async function resolveLinkedStatusByKeys(args: {
  tx: any;
  orderCode: string;
  designName: string;
  size: string | null;
}) {
  const linked = await resolveOrderItemByDesignAndSize({
    tx: args.tx,
    orderCode: args.orderCode,
    designName: args.designName,
    size: args.size,
  });

  return linked?.status ?? null;
}

async function resolveOrderItemByDesignAndSize(args: {
  tx: any;
  orderCode: string;
  designName: string;
  size: string | null;
}) {
  const orderCode = String(args.orderCode ?? "").trim();
  const designName = normalizeMatchText(args.designName);
  const size = normalizeMatchText(args.size);

  if (!orderCode || !designName) return null;

  const candidates = await args.tx
    .select({
      id: orderItems.id,
      status: orderItems.status,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.orderCode, orderCode),
        sql`lower(trim(coalesce(${orderItems.name}, ''))) = ${designName}`,
      ),
    )
    .limit(20);

  if (!candidates.length) return null;

  if (!size) {
    return candidates[0] ?? null;
  }

  const candidateIds = candidates.map((candidate: { id: string }) => candidate.id);
  const packagingMatches = await args.tx
    .select({ orderItemId: orderItemPackaging.orderItemId })
    .from(orderItemPackaging)
    .where(
      and(
        inArray(orderItemPackaging.orderItemId, candidateIds),
        sql`lower(trim(coalesce(${orderItemPackaging.size}, ''))) = ${size}`,
      ),
    );

  const socksMatches = await args.tx
    .select({ orderItemId: orderItemSocks.orderItemId })
    .from(orderItemSocks)
    .where(
      and(
        inArray(orderItemSocks.orderItemId, candidateIds),
        sql`lower(trim(coalesce(${orderItemSocks.size}, ''))) = ${size}`,
      ),
    );

  const allowedIds = new Set(
    [...packagingMatches, ...socksMatches]
      .map((row) => String(row.orderItemId ?? "").trim())
      .filter(Boolean),
  );

  if (!allowedIds.size) return null;

  return (
    candidates.find((candidate: { id: string }) => allowedIds.has(String(candidate.id))) ?? null
  );
}

async function updateOrderItemStatus(args: {
  tx: any;
  orderItemId: string;
  nextStatus: OrderItemStatus;
  changedByEmployeeId: string | null;
}) {
  await args.tx
    .update(orderItems)
    .set({ status: args.nextStatus })
    .where(eq(orderItems.id, args.orderItemId));

  await args.tx.insert(orderItemStatusHistory).values({
    orderItemId: args.orderItemId,
    status: args.nextStatus,
    changedBy: args.changedByEmployeeId,
  });
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "dashboard:operative-logs:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);
  if (!role || !DASHBOARD_ROLES.has(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const roleArea = normalizeRoleArea(searchParams.get("roleArea"));

    const where = roleArea ? and(eq(operativeDashboardLogs.roleArea, roleArea)) : undefined;

    const totalQuery = db
      .select({ total: sql<number>`count(*)::int` })
      .from(operativeDashboardLogs);

    const [{ total }] = where
      ? await totalQuery.where(where)
      : await totalQuery;

    const itemsQuery = db
      .select()
      .from(operativeDashboardLogs)
      .orderBy(desc(operativeDashboardLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items = where ? await itemsQuery.where(where) : await itemsQuery;

    const itemsWithLinkedStatus = await Promise.all(
      items.map(async (item) => {
        const linkedOrderItemStatus = await resolveLinkedStatusByKeys({
          tx: db,
          orderCode: String(item.orderCode ?? ""),
          designName: String(item.designName ?? ""),
          size: item.size,
        });

        return {
          ...item,
          linkedOrderItemStatus,
        };
      }),
    );

    return Response.json({
      items: itemsWithLinkedStatus,
      page,
      pageSize,
      total,
      hasNextPage: offset + itemsWithLinkedStatus.length < total,
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar dashboard operativo", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "dashboard:operative-logs:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);
  if (!role || !DASHBOARD_ROLES.has(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = (await request.json()) as Record<string, unknown>;

  const roleArea = normalizeRoleArea(body.roleArea);
  if (!roleArea) return new Response("roleArea inválido", { status: 400 });

  const operationType = normalizeOperationType(body.operationType);
  const processCode = normalizeProcessCode(body.processCode);
  if (!processCode) return new Response("processCode inválido", { status: 400 });

  const orderCode = String(body.orderCode ?? "").trim();
  if (!orderCode) return new Response("orderCode es requerido", { status: 400 });

  const designName = String(body.designName ?? "").trim();
  if (!designName) return new Response("designName es requerido", { status: 400 });

  const quantityOp = parseNonNegativeInt(body.quantityOp);
  if (quantityOp === null) return new Response("quantityOp inválido", { status: 400 });

  const producedQuantity = parseNonNegativeInt(body.producedQuantity);
  if (producedQuantity === null) {
    return new Response("producedQuantity inválido", { status: 400 });
  }

  const startAt = parseDateTime(body.startAt);
  const endAt = parseDateTime(body.endAt);

  const createdByUserId = getUserIdFromRequest(request);
  const changedByEmployeeId = await getEmployeeIdFromRequest(request);

  try {
    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(operativeDashboardLogs)
        .values({
          roleArea,
          operationType,
          orderCode,
          designName,
          details: toOptionalText(body.details),
          size: toOptionalText(body.size),
          quantityOp,
          producedQuantity,
          startAt,
          endAt,
          isComplete: toBoolean(body.isComplete),
          isPartial: toBoolean(body.isPartial),
          observations: toOptionalText(body.observations),
          repoCheck: toBoolean(body.repoCheck),
          processCode,
          createdByUserId,
        })
        .returning();

      const linkedItem = await resolveOrderItemByDesignAndSize({
        tx,
        orderCode,
        designName,
        size: toOptionalText(body.size),
      });

      let linkedOrderItemId: string | null = linkedItem?.id ?? null;
      let appliedStatus: OrderItemStatus | null = null;

      if (linkedItem?.id) {
        const isComplete = toBoolean(body.isComplete);
        const isPartial = toBoolean(body.isPartial);
        const repoCheck = toBoolean(body.repoCheck);

        if (isComplete && operationType) {
          const nextStatus = NEXT_STATUS_BY_OPERATION[operationType];
          if (shouldMoveForward(linkedItem.status, nextStatus)) {
            await updateOrderItemStatus({
              tx,
              orderItemId: linkedItem.id,
              nextStatus,
              changedByEmployeeId,
            });
            appliedStatus = nextStatus;
          }
        }

        if (isPartial && repoCheck) {
          await updateOrderItemStatus({
            tx,
            orderItemId: linkedItem.id,
            nextStatus: "EN_REVISION_CAMBIO",
            changedByEmployeeId,
          });
          appliedStatus = "EN_REVISION_CAMBIO";
        }
      }

      return {
        ...created,
        linkedOrderItemId,
        appliedStatus,
      };
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo crear registro operativo", { status: 500 });
  }
}
