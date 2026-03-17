import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { ORDER_ITEM_STATUS, ORDER_ITEM_STATUS_VALUES } from "@/src/utils/order-status";

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
  "MONTAJE",
  "PLOTTER",
  "SUBLIMACION",
  "CALANDRA",
  "CORTE_LASER",
  "CORTE_MANUAL",
  "CONFECCION",
  "EMPAQUE",
  "INTEGRACION",
  "DESPACHO",
] as const;
const PROCESS_CODES = ["P", "S", "C"] as const;

const ORDER_ITEM_STATUS_FLOW = [
  ORDER_ITEM_STATUS.PENDIENTE,
  ORDER_ITEM_STATUS.APROBACION,
  ORDER_ITEM_STATUS.PENDIENTE_PRODUCCION,
  ORDER_ITEM_STATUS.MONTAJE,
  ORDER_ITEM_STATUS.IMPRESION,
  ORDER_ITEM_STATUS.SUBLIMACION,
  ORDER_ITEM_STATUS.CORTE_MANUAL,
  ORDER_ITEM_STATUS.CORTE_LASER,
  ORDER_ITEM_STATUS.PENDIENTE_CONFECCION,
  ORDER_ITEM_STATUS.CONFECCION,
  ORDER_ITEM_STATUS.EN_BODEGA,
  ORDER_ITEM_STATUS.EMPAQUE,
  ORDER_ITEM_STATUS.ENVIADO,
  ORDER_ITEM_STATUS.COMPLETADO,
] as const;

type OrderItemStatusType = (typeof ORDER_ITEM_STATUS_VALUES)[number];

const NEXT_STATUS_BY_OPERATION: Record<
  (typeof OPERATION_TYPES)[number],
  OrderItemStatusType
> = {
  MONTAJE: ORDER_ITEM_STATUS.MONTAJE,
  PLOTTER: ORDER_ITEM_STATUS.IMPRESION,
  SUBLIMACION: ORDER_ITEM_STATUS.SUBLIMACION,
  CALANDRA: ORDER_ITEM_STATUS.CORTE_MANUAL,
  CORTE_LASER: ORDER_ITEM_STATUS.PENDIENTE_CONFECCION,
  CORTE_MANUAL: ORDER_ITEM_STATUS.PENDIENTE_CONFECCION,
  CONFECCION: ORDER_ITEM_STATUS.CONFECCION,
  EMPAQUE: ORDER_ITEM_STATUS.EMPAQUE,
  INTEGRACION: ORDER_ITEM_STATUS.EN_BODEGA,
  DESPACHO: ORDER_ITEM_STATUS.ENVIADO,
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

function shouldMoveForward(current: string | null, next: OrderItemStatusType) {
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
  nextStatus: OrderItemStatusType;
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
    const rawRoleArea = String(searchParams.get("roleArea") ?? "").trim();
    const rawOperationType = String(searchParams.get("operationType") ?? "").trim();
    const roleArea = normalizeRoleArea(searchParams.get("roleArea"));
    const operationType = normalizeOperationType(searchParams.get("operationType"));

    if (rawRoleArea && !roleArea) {
      return new Response("roleArea inválido", { status: 400 });
    }

    if (rawOperationType && !operationType) {
      return new Response("operationType inválido", { status: 400 });
    }

    const filters = [
      roleArea ? eq(operativeDashboardLogs.roleArea, roleArea) : undefined,
      operationType ? eq(operativeDashboardLogs.operationType, operationType) : undefined,
    ].filter(Boolean);

    const where = filters.length ? and(...filters) : undefined;

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
      let appliedStatus: OrderItemStatusType | null = null;

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
            nextStatus: ORDER_ITEM_STATUS.PENDIENTE_PRODUCCION_ACTUALIZACION,
            changedByEmployeeId,
          });
          appliedStatus = ORDER_ITEM_STATUS.PENDIENTE_PRODUCCION_ACTUALIZACION;
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
