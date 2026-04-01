import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  ORDER_ITEM_STATUS,
  ORDER_ITEM_STATUS_VALUES,
  ORDER_STATUS,
} from "@/src/utils/order-status";
import { db } from "@/src/db";
import {
  operativeDashboardLogs,
  orderItemPackaging,
  orderItemSocks,
  orderItemStatusHistory,
  orderItems,
  orderStatusHistory,
  orders,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import {
  ensureDateRange,
  parsePaginationStrict,
} from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

const ROLE_AREAS = [
  "OPERARIOS",
  "CONFECCIONISTAS",
  "MENSAJERIA",
  "EMPAQUE",
] as const;
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
const MONTAJE_TAKE_ORDER_MARKER = "[MONTAJE_TAKE_ORDER]";

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
  MONTAJE: ORDER_ITEM_STATUS.IMPRESION,
  PLOTTER: ORDER_ITEM_STATUS.SUBLIMACION,
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
  "OPERARIO",
  "OPERARIO_BODEGA",
  "OPERARIO_INTEGRACION_CALIDAD",
  "OPERARIO_DESPACHO",
]);

function normalizeRoleArea(v: unknown) {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();

  if (ROLE_AREAS.includes(raw as (typeof ROLE_AREAS)[number])) {
    return raw as (typeof ROLE_AREAS)[number];
  }

  return null;
}

function normalizeOperationType(v: unknown) {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();

  if (OPERATION_TYPES.includes(raw as (typeof OPERATION_TYPES)[number])) {
    return raw as (typeof OPERATION_TYPES)[number];
  }

  return null;
}

function normalizeProcessCode(v: unknown) {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();

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
  const raw = String(v ?? "")
    .trim()
    .toLowerCase();

  return raw === "true" || raw === "1" || raw === "si" || raw === "sí";
}

function normalizeMatchText(v: unknown) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function shouldMoveForward(current: string | null, next: OrderItemStatusType) {
  if (!current) return true;

  const currentIndex = ORDER_ITEM_STATUS_FLOW.indexOf(
    current as (typeof ORDER_ITEM_STATUS_FLOW)[number],
  );
  const nextIndex = ORDER_ITEM_STATUS_FLOW.indexOf(
    next as (typeof ORDER_ITEM_STATUS_FLOW)[number],
  );

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

  const candidateIds = candidates.map(
    (candidate: { id: string }) => candidate.id,
  );
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
    candidates.find((candidate: { id: string }) =>
      allowedIds.has(String(candidate.id)),
    ) ?? null
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

async function resolveActiveMontajeTakeOrder(args: {
  tx: any;
  orderCode: string;
}) {
  const [assignment] = await args.tx
    .select()
    .from(operativeDashboardLogs)
    .where(
      and(
        eq(operativeDashboardLogs.orderCode, args.orderCode),
        eq(operativeDashboardLogs.operationType, "MONTAJE"),
        eq(operativeDashboardLogs.details, MONTAJE_TAKE_ORDER_MARKER),
        eq(operativeDashboardLogs.isComplete, false),
      ),
    )
    .orderBy(desc(operativeDashboardLogs.createdAt))
    .limit(1);

  return assignment ?? null;
}

async function moveOrderToProduccionWhenTaken(args: {
  tx: any;
  orderCode: string;
  changedByEmployeeId: string | null;
}) {
  const [orderRow] = await args.tx
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.orderCode, args.orderCode))
    .limit(1);

  if (!orderRow) return;
  if (orderRow.status !== ORDER_STATUS.PROGRAMACION) return;

  await args.tx
    .update(orders)
    .set({ status: ORDER_STATUS.PRODUCCION as any })
    .where(eq(orders.id, orderRow.id));

  await args.tx.insert(orderStatusHistory).values({
    orderId: orderRow.id,
    status: ORDER_STATUS.PRODUCCION,
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
    const { page, pageSize, offset } = parsePaginationStrict(searchParams, {
      defaultPageSize: 20,
      maxPageSize: 100,
    });
    const range = ensureDateRange(searchParams, {
      defaultDays: 7,
      maxDays: 90,
    });
    const rawRoleArea = String(searchParams.get("roleArea") ?? "").trim();
    const rawOperationType = String(
      searchParams.get("operationType") ?? "",
    ).trim();
    const includeAssignments =
      String(searchParams.get("includeAssignments") ?? "").trim() === "1";
    const assignmentType = String(searchParams.get("assignmentType") ?? "")
      .trim()
      .toUpperCase();
    const roleArea = normalizeRoleArea(searchParams.get("roleArea"));
    const operationType = normalizeOperationType(
      searchParams.get("operationType"),
    );

    if (rawRoleArea && !roleArea) {
      return new Response("roleArea inválido", { status: 400 });
    }

    if (rawOperationType && !operationType) {
      return new Response("operationType inválido", { status: 400 });
    }

    if (assignmentType && assignmentType !== "TAKE_ORDER") {
      return new Response("assignmentType inválido", { status: 400 });
    }

    const filters = [
      roleArea ? eq(operativeDashboardLogs.roleArea, roleArea) : undefined,
      operationType
        ? eq(operativeDashboardLogs.operationType, operationType)
        : undefined,
      assignmentType === "TAKE_ORDER"
        ? eq(operativeDashboardLogs.details, MONTAJE_TAKE_ORDER_MARKER)
        : undefined,
      !includeAssignments && assignmentType !== "TAKE_ORDER"
        ? sql`coalesce(${operativeDashboardLogs.details}, '') <> ${MONTAJE_TAKE_ORDER_MARKER}`
        : undefined,
      sql`date(${operativeDashboardLogs.createdAt}) >= ${range.dateFrom}::date`,
      sql`date(${operativeDashboardLogs.createdAt}) <= ${range.dateTo}::date`,
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
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
    });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    if (error instanceof RangeError) {
      return new Response(error.message, { status: 400 });
    }

    return new Response("No se pudo consultar dashboard operativo", {
      status: 500,
    });
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
  const takeOrder = toBoolean(body.takeOrder);

  if (!processCode)
    return new Response("processCode inválido", { status: 400 });

  const orderCode = String(body.orderCode ?? "").trim();

  if (!orderCode)
    return new Response("orderCode es requerido", { status: 400 });

  const designName = String(body.designName ?? "").trim();

  if (!designName)
    return new Response("designName es requerido", { status: 400 });

  const quantityOp = parseNonNegativeInt(body.quantityOp);

  if (quantityOp === null)
    return new Response("quantityOp inválido", { status: 400 });

  const producedQuantity = parseNonNegativeInt(body.producedQuantity);

  if (producedQuantity === null) {
    return new Response("producedQuantity inválido", { status: 400 });
  }

  const parsedStartAt = parseDateTime(body.startAt);
  const parsedEndAt = parseDateTime(body.endAt);
  const isComplete = toBoolean(body.isComplete);
  const isPartial = toBoolean(body.isPartial);
  const authorizeManualCut = toBoolean(body.authorizeManualCut);
  const repoCheck = toBoolean(body.repoCheck);

  const createdByUserId = getUserIdFromRequest(request);
  const changedByEmployeeId = await getEmployeeIdFromRequest(request);

  if (!createdByUserId && operationType === "MONTAJE") {
    return new Response("Usuario no autenticado para montaje", { status: 403 });
  }

  if (takeOrder && operationType !== "MONTAJE") {
    return new Response("takeOrder solo aplica para operación MONTAJE", {
      status: 400,
    });
  }

  try {
    const result = await db.transaction(async (tx) => {
      if (operationType === "MONTAJE") {
        const activeTakeOrder = await resolveActiveMontajeTakeOrder({
          tx,
          orderCode,
        });

        if (takeOrder) {
          if (
            activeTakeOrder &&
            activeTakeOrder.createdByUserId &&
            activeTakeOrder.createdByUserId !== createdByUserId
          ) {
            return {
              conflict: true,
              claimedByUserId: activeTakeOrder.createdByUserId,
              takenAt: activeTakeOrder.startAt ?? activeTakeOrder.createdAt,
            };
          }

          if (activeTakeOrder?.id) {
            return {
              ...activeTakeOrder,
              linkedOrderItemId: null,
              appliedStatus: null,
              isTakeOrder: true,
            };
          }

          const [createdTakeOrder] = await tx
            .insert(operativeDashboardLogs)
            .values({
              roleArea,
              operationType,
              orderCode,
              designName,
              details: MONTAJE_TAKE_ORDER_MARKER,
              size: null,
              quantityOp: 0,
              producedQuantity: 0,
              startAt: new Date(),
              endAt: null,
              isComplete: false,
              isPartial: false,
              observations: toOptionalText(body.observations),
              repoCheck: false,
              processCode,
              createdByUserId,
            })
            .returning();

          await moveOrderToProduccionWhenTaken({
            tx,
            orderCode,
            changedByEmployeeId,
          });

          return {
            ...createdTakeOrder,
            linkedOrderItemId: null,
            appliedStatus: null,
            isTakeOrder: true,
          };
        }

        if (!activeTakeOrder?.id) {
          return {
            conflict: true,
            message:
              "Debes tomar el pedido en montaje antes de registrar producción.",
          };
        }

        if (
          activeTakeOrder.createdByUserId &&
          activeTakeOrder.createdByUserId !== createdByUserId
        ) {
          return {
            conflict: true,
            message: "Este pedido ya fue tomado por otro operario en montaje.",
            claimedByUserId: activeTakeOrder.createdByUserId,
            takenAt: activeTakeOrder.startAt ?? activeTakeOrder.createdAt,
          };
        }
      }

      let effectiveStartAt = parsedStartAt;
      let effectiveEndAt = parsedEndAt;

      if (operationType === "MONTAJE") {
        const activeTakeOrder = await resolveActiveMontajeTakeOrder({
          tx,
          orderCode,
        });

        effectiveStartAt =
          activeTakeOrder?.startAt ?? activeTakeOrder?.createdAt ?? new Date();
        effectiveEndAt = isComplete ? new Date() : null;
      }

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
          startAt: effectiveStartAt,
          endAt: effectiveEndAt,
          isComplete,
          isPartial,
          observations: toOptionalText(body.observations),
          repoCheck,
          processCode,
          createdByUserId,
        })
        .returning();

      if (operationType === "MONTAJE" && isComplete) {
        await tx
          .update(operativeDashboardLogs)
          .set({
            isComplete: true,
            endAt: effectiveEndAt,
          })
          .where(
            and(
              eq(operativeDashboardLogs.orderCode, orderCode),
              eq(operativeDashboardLogs.operationType, "MONTAJE"),
              eq(operativeDashboardLogs.details, MONTAJE_TAKE_ORDER_MARKER),
              eq(operativeDashboardLogs.isComplete, false),
            ),
          );
      }

      const linkedItem = await resolveOrderItemByDesignAndSize({
        tx,
        orderCode,
        designName,
        size: toOptionalText(body.size),
      });

      let linkedOrderItemId: string | null = linkedItem?.id ?? null;
      let appliedStatus: OrderItemStatusType | null = null;

      if (linkedItem?.id) {
        if (isComplete && operationType) {
          const nextStatus =
            operationType === "MONTAJE" && (authorizeManualCut || processCode === "C")
              ? ORDER_ITEM_STATUS.CORTE_MANUAL
              : NEXT_STATUS_BY_OPERATION[operationType];

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
            nextStatus: ORDER_ITEM_STATUS.APROBACION_ACTUALIZACION,
            changedByEmployeeId,
          });
          appliedStatus = ORDER_ITEM_STATUS.APROBACION_ACTUALIZACION;
        }
      }

      return {
        ...created,
        linkedOrderItemId,
        appliedStatus,
      };
    });

    if ((result as any)?.conflict) {
      return Response.json(result, { status: 409 });
    }

    return Response.json(result, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo crear registro operativo", { status: 500 });
  }
}
