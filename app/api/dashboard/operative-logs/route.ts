import { and, desc, eq, sql } from "drizzle-orm";

import {
  ORDER_ITEM_STATUS,
  ORDER_ITEM_STATUS_VALUES,
  ORDER_STATUS,
} from "@/src/utils/order-status";
import { erpDb, mesDb } from "@/src/db";
import {
  orderItemStatusHistory,
  orderItems,
  orderStatusHistory,
  orders,
} from "@/src/db/erp/schema";
import { operativeDashboardLogs } from "@/src/db/mes/schema";
import {
  getEmailFromRequest,
  getEmployeeIdFromRequest,
  getMesAccessFromRequest,
  getRoleFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import {
  buildOperativeLogLinkFields,
  resolveOperativeLogLink,
} from "@/src/utils/operative-log-links";
import {
  ensureDateRange,
  parsePaginationStrict,
} from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { isOperarioRole } from "@/src/utils/role-status";

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
  "MENSAJERO",
]);

function canAccessOperativeDashboard(role: string | null) {
  if (!role) {
    return false;
  }

  return DASHBOARD_ROLES.has(role) || isOperarioRole(role);
}

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
  erpTx: any;
  storedOrderId?: string | null;
  storedOrderItemId?: string | null;
  orderCode: string;
  designName: string;
  size: string | null;
}) {
  const linked = await resolveOperativeLogLink({
    erpTx: args.erpTx,
    storedOrderId: args.storedOrderId,
    storedOrderItemId: args.storedOrderItemId,
    orderCode: args.orderCode,
    designName: args.designName,
    size: args.size,
  });


  return {
    linkedOrderId: linked.orderId,
    linkedOrderItemId: linked.orderItemId,
    linkedOrderItemStatus: linked.status,
    linkStrategy: linked.strategy,
  };
}

async function updateOrderItemStatus(args: {
  erpTx: any;
  orderItemId: string;
  nextStatus: OrderItemStatusType;
  changedByEmployeeId: string | null;
}) {
  await args.erpTx
    .update(orderItems)
    .set({ status: args.nextStatus })
    .where(eq(orderItems.id, args.orderItemId));

  await args.erpTx.insert(orderItemStatusHistory).values({
    orderItemId: args.orderItemId,
    status: args.nextStatus,
    changedBy: args.changedByEmployeeId,
  });
}

async function resolveActiveMontajeTakeOrder(args: {
  mesTx: any;
  orderCode: string;
}) {
  const [assignment] = await args.mesTx
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
  erpTx: any;
  orderCode: string;
  changedByEmployeeId: string | null;
}) {
  const [orderRow] = await args.erpTx
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(eq(orders.orderCode, args.orderCode))
    .limit(1);

  if (!orderRow) return;
  if (orderRow.status !== ORDER_STATUS.PROGRAMACION) return;

  await args.erpTx
    .update(orders)
    .set({ status: ORDER_STATUS.PRODUCCION as any })
    .where(eq(orders.id, orderRow.id));

  await args.erpTx.insert(orderStatusHistory).values({
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

  if (!canAccessOperativeDashboard(role)) {
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

    const totalQuery = mesDb
      .select({ total: sql<number>`count(*)::int` })
      .from(operativeDashboardLogs);

    const [{ total }] = where
      ? await totalQuery.where(where)
      : await totalQuery;

    const itemsQuery = mesDb
      .select()
      .from(operativeDashboardLogs)
      .orderBy(desc(operativeDashboardLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    const items = where ? await itemsQuery.where(where) : await itemsQuery;

    const itemsWithLinkedStatus = await Promise.all(
      items.map(async (item) => {
        const linked = await resolveLinkedStatusByKeys({
          erpTx: erpDb,
          storedOrderId: item.orderId,
          storedOrderItemId: item.orderItemId,
          orderCode: String(item.orderCode ?? ""),
          designName: String(item.designName ?? ""),
          size: item.size,
        });

        return {
          ...item,
          ...linked,
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

  if (!canAccessOperativeDashboard(role)) {
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
  const size = toOptionalText(body.size);
  const mesAccess = getMesAccessFromRequest(request);

  const createdByUserId = getUserIdFromRequest(request);
  const changedByEmployeeId = await getEmployeeIdFromRequest(request);
  const operatorEmployeeId = mesAccess?.employeeId ?? changedByEmployeeId;
  const operatorName = mesAccess?.employeeName ?? null;
  const operatorEmail = mesAccess?.employeeEmail ?? getEmailFromRequest(request);
  const machineId = mesAccess?.machineId ?? null;
  const machineName = mesAccess?.machineName ?? null;

  if (!createdByUserId && !operatorEmployeeId && operationType === "MONTAJE") {
    return new Response("Usuario no autenticado para montaje", { status: 403 });
  }

  if (takeOrder && operationType !== "MONTAJE") {
    return new Response("takeOrder solo aplica para operación MONTAJE", {
      status: 400,
    });
  }

  try {
    let activeTakeOrder =
      operationType === "MONTAJE"
        ? await resolveActiveMontajeTakeOrder({
            mesTx: mesDb,
            orderCode,
          })
        : null;
    const resolvedLink = await resolveOperativeLogLink({
      erpTx: erpDb,
      orderCode,
      designName,
      size,
      storedOrderId: activeTakeOrder?.orderId ?? null,
      storedOrderItemId: activeTakeOrder?.orderItemId ?? null,
    });

    if (operationType === "MONTAJE") {
      if (takeOrder) {
        if (
          activeTakeOrder &&
          ((activeTakeOrder.operatorEmployeeId &&
            activeTakeOrder.operatorEmployeeId !== operatorEmployeeId) ||
            (!activeTakeOrder.operatorEmployeeId &&
              activeTakeOrder.createdByUserId &&
              activeTakeOrder.createdByUserId !== createdByUserId))
        ) {
          return Response.json(
            {
              conflict: true,
              claimedByUserId:
                activeTakeOrder.operatorEmployeeId ?? activeTakeOrder.createdByUserId,
              takenAt: activeTakeOrder.startAt ?? activeTakeOrder.createdAt,
            },
            { status: 409 },
          );
        }

        if (activeTakeOrder?.id) {
          return Response.json(
            {
              ...activeTakeOrder,
              linkedOrderId: activeTakeOrder.orderId ?? resolvedLink.orderId,
              linkedOrderItemId:
                activeTakeOrder.orderItemId ?? resolvedLink.orderItemId,
              linkedOrderItemStatus: resolvedLink.status,
              appliedStatus: null,
              isTakeOrder: true,
            },
            { status: 201 },
          );
        }

        const [createdTakeOrder] = await mesDb
          .insert(operativeDashboardLogs)
          .values({
            roleArea,
            operationType,
            ...buildOperativeLogLinkFields({
              orderId: resolvedLink.orderId,
              orderItemId: resolvedLink.orderItemId,
            }),
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
            operatorEmployeeId,
            operatorName,
            operatorEmail,
            machineId,
            machineName,
            createdByUserId,
          })
          .returning();

        try {
          await erpDb.transaction(async (erpTx) => {
            await moveOrderToProduccionWhenTaken({
              erpTx,
              orderCode,
              changedByEmployeeId,
            });
          });
        } catch (error) {
          await mesDb
            .delete(operativeDashboardLogs)
            .where(eq(operativeDashboardLogs.id, createdTakeOrder.id));
          throw error;
        }

        return Response.json(
          {
            ...createdTakeOrder,
            linkedOrderId: resolvedLink.orderId,
            linkedOrderItemId: resolvedLink.orderItemId,
            linkedOrderItemStatus: resolvedLink.status,
            appliedStatus: null,
            isTakeOrder: true,
          },
          { status: 201 },
        );
      }

      if (!activeTakeOrder?.id) {
        return Response.json(
          {
            conflict: true,
            message:
              "Debes tomar el pedido en montaje antes de registrar producción.",
          },
          { status: 409 },
        );
      }

      if (
        (activeTakeOrder.operatorEmployeeId &&
          activeTakeOrder.operatorEmployeeId !== operatorEmployeeId) ||
        (!activeTakeOrder.operatorEmployeeId &&
          activeTakeOrder.createdByUserId &&
          activeTakeOrder.createdByUserId !== createdByUserId)
      ) {
        return Response.json(
          {
            conflict: true,
            message: "Este pedido ya fue tomado por otro operario en montaje.",
            claimedByUserId:
              activeTakeOrder.operatorEmployeeId ?? activeTakeOrder.createdByUserId,
            takenAt: activeTakeOrder.startAt ?? activeTakeOrder.createdAt,
          },
          { status: 409 },
        );
      }
    }

    let effectiveStartAt = parsedStartAt;
    let effectiveEndAt = parsedEndAt;

    if (operationType === "MONTAJE") {
      effectiveStartAt =
        activeTakeOrder?.startAt ?? activeTakeOrder?.createdAt ?? new Date();
      effectiveEndAt = isComplete ? new Date() : null;
    }

    const [created] = await mesDb
      .insert(operativeDashboardLogs)
      .values({
        roleArea,
        operationType,
        ...buildOperativeLogLinkFields({
          orderId: resolvedLink.orderId,
          orderItemId: resolvedLink.orderItemId,
        }),
        orderCode,
        designName,
        details: toOptionalText(body.details),
        size,
        quantityOp,
        producedQuantity,
        startAt: effectiveStartAt,
        endAt: effectiveEndAt,
        isComplete,
        isPartial,
        observations: toOptionalText(body.observations),
        repoCheck,
        processCode,
        operatorEmployeeId,
        operatorName,
        operatorEmail,
        machineId,
        machineName,
        createdByUserId,
      })
      .returning();

    let completedTakeOrderUpdated = false;

    if (operationType === "MONTAJE" && isComplete) {
      await mesDb
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
      completedTakeOrderUpdated = true;
    }

    try {
      const erpResult = await erpDb.transaction(async (erpTx) => {
        const linkedItem = await resolveOperativeLogLink({
          erpTx,
          storedOrderId: resolvedLink.orderId,
          storedOrderItemId: resolvedLink.orderItemId,
          orderCode,
          designName,
          size,
        });

        let appliedStatus: OrderItemStatusType | null = null;

        if (linkedItem.orderItemId) {
          if (isComplete && operationType) {
            const nextStatus =
              operationType === "MONTAJE" &&
              (authorizeManualCut || processCode === "C")
                ? ORDER_ITEM_STATUS.CORTE_MANUAL
                : NEXT_STATUS_BY_OPERATION[operationType];

            if (shouldMoveForward(linkedItem.status, nextStatus)) {
              await updateOrderItemStatus({
                erpTx,
                orderItemId: linkedItem.orderItemId,
                nextStatus,
                changedByEmployeeId,
              });
              appliedStatus = nextStatus;
            }
          }

          if (isPartial && repoCheck) {
            await updateOrderItemStatus({
              erpTx,
              orderItemId: linkedItem.orderItemId,
              nextStatus: ORDER_ITEM_STATUS.APROBACION_ACTUALIZACION,
              changedByEmployeeId,
            });
            appliedStatus = ORDER_ITEM_STATUS.APROBACION_ACTUALIZACION;
          }
        }

        return {
          linkedOrderId: linkedItem.orderId,
          linkedOrderItemId: linkedItem.orderItemId,
          linkedOrderItemStatus: linkedItem.status,
          appliedStatus,
        };
      });

      return Response.json(
        {
          ...created,
          ...erpResult,
        },
        { status: 201 },
      );
    } catch (error) {
      await mesDb
        .delete(operativeDashboardLogs)
        .where(eq(operativeDashboardLogs.id, created.id));

      if (completedTakeOrderUpdated) {
        await mesDb
          .update(operativeDashboardLogs)
          .set({
            isComplete: false,
            endAt: null,
          })
          .where(
            and(
              eq(operativeDashboardLogs.orderCode, orderCode),
              eq(operativeDashboardLogs.operationType, "MONTAJE"),
              eq(operativeDashboardLogs.details, MONTAJE_TAKE_ORDER_MARKER),
            ),
          );
      }

      throw error;
    }
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo crear registro operativo", { status: 500 });
  }
}
