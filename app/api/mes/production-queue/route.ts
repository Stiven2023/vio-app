import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { erpDb, mesDb } from "@/src/db";
import {
  clients,
  orderItemPackaging,
  orderItems,
  orders,
  preInvoices,
  quotations,
  employees,
} from "@/src/db/erp/schema";
import { mesProductionQueue } from "@/src/db/mes/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { createNotificationForRoles } from "@/src/utils/notifications";
import { rateLimit } from "@/src/utils/rate-limit";

const ALLOWED_ROLES = new Set([
  "ADMINISTRADOR",
  "LIDER_OPERACIONAL",
  "PROGRAMACION",
]);

const PRIORITY_VALUES = ["URGENTE", "NORMAL", "BAJA"] as const;

function canWrite(role: string | null) {
  return role === "ADMINISTRADOR" || role === "LIDER_OPERACIONAL";
}

function toQueueKey(orderItemId: string, size: string | null | undefined) {
  const item = String(orderItemId ?? "").trim();
  const talla = String(size ?? "")
    .trim()
    .toUpperCase();

  return `${item}::${talla}`;
}

async function ensureQueueFromProgramacionOrders() {
  const candidates = await erpDb
    .select({
      orderId: orders.id,
      orderItemId: orderItems.id,
      design: orderItems.name,
      itemQuantity: orderItems.quantity,
      orderDate: orders.createdAt,
      deliveryDate: sql<string | null>`coalesce(${orders.deliveryDate}, ${quotations.deliveryDate})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(preInvoices, eq(preInvoices.orderId, orders.id))
    .leftJoin(quotations, eq(quotations.id, preInvoices.quotationId))
    .where(
      and(
        eq(orders.status, "PROGRAMACION" as any),
        sql`(
          case
            when upper(trim(coalesce(${orderItems.process}, ''))) in ('PRODUCCION', 'BODEGA', 'COMPRAS')
              then upper(trim(coalesce(${orderItems.process}, '')))
            else 'PRODUCCION'
          end
        ) = 'PRODUCCION'`,
      ),
    );

  if (candidates.length === 0) return;

  const orderItemIds = Array.from(
    new Set(candidates.map((row) => String(row.orderItemId ?? "").trim())),
  ).filter(Boolean);

  const packagingRows = orderItemIds.length
    ? await erpDb
        .select({
          orderItemId: orderItemPackaging.orderItemId,
          mode: orderItemPackaging.mode,
          size: orderItemPackaging.size,
          quantity: orderItemPackaging.quantity,
          rowOrder: orderItemPackaging.id,
        })
        .from(orderItemPackaging)
        .where(sql`${orderItemPackaging.orderItemId} in ${orderItemIds}`)
        .orderBy(orderItemPackaging.id)
    : [];

  const packagingByItem = new Map<
    string,
    Array<{ mode: string; size: string; quantity: number; rowOrder: string }>
  >();

  for (const row of packagingRows) {
    const itemId = String(row.orderItemId ?? "").trim();
    const mode = String(row.mode ?? "").trim().toUpperCase();
    const size = String(row.size ?? "").trim();
    const quantity = Number(row.quantity ?? 0);

    if (!itemId || !size || !Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    const current = packagingByItem.get(itemId) ?? [];

    current.push({
      mode,
      size,
      quantity: Math.max(1, Math.floor(quantity)),
      rowOrder: String(row.rowOrder ?? ""),
    });
    packagingByItem.set(itemId, current);
  }

  const existingRows = await mesDb
    .select({
      orderItemId: mesProductionQueue.orderItemId,
      size: mesProductionQueue.size,
      status: mesProductionQueue.status,
    })
    .from(mesProductionQueue)
    .where(sql`${mesProductionQueue.orderItemId} in ${orderItemIds}`);

  const existingKeys = new Set(
    existingRows
      .filter((row) => String(row.status ?? "") !== "COMPLETADO")
      .map((row) =>
        toQueueKey(String(row.orderItemId ?? ""), String(row.size ?? "")),
      ),
  );

  const toInsert: Array<typeof mesProductionQueue.$inferInsert> = [];

  for (const row of candidates) {
    const itemId = String(row.orderItemId ?? "").trim();
    const grouped = (packagingByItem.get(itemId) ?? []).filter(
      (p) => p.mode === "AGRUPADO",
    );
    const sourceSizes = grouped.length > 0 ? grouped : (packagingByItem.get(itemId) ?? []);
    const orderDateTs = row.orderDate ? new Date(row.orderDate).getTime() : Date.now();
    const deliveryTs = row.deliveryDate
      ? new Date(row.deliveryDate).getTime()
      : orderDateTs;
    const suggestedOrder = Math.floor((Number.isFinite(deliveryTs) ? deliveryTs : Date.now()) / 1000);

    if (sourceSizes.length === 0) {
      const key = toQueueKey(itemId, null);

      if (existingKeys.has(key)) continue;

      toInsert.push({
        orderId: String(row.orderId),
        orderItemId: itemId,
        design: String(row.design ?? "Diseño"),
        size: null,
        quantityTotal: Math.max(1, Math.floor(Number(row.itemQuantity ?? 1))),
        priority: "NORMAL",
        suggestedOrder,
        finalOrder: suggestedOrder + 1_000_000,
        status: "EN_COLA",
      });
      existingKeys.add(key);
      continue;
    }

    for (const sizeRow of sourceSizes) {
      const key = toQueueKey(itemId, sizeRow.size);

      if (existingKeys.has(key)) continue;

      toInsert.push({
        orderId: String(row.orderId),
        orderItemId: itemId,
        design: String(row.design ?? "Diseño"),
        size: sizeRow.size,
        quantityTotal: sizeRow.quantity,
        priority: "NORMAL",
        suggestedOrder,
        finalOrder: suggestedOrder + 1_000_000,
        status: "EN_COLA",
      });
      existingKeys.add(key);
    }
  }

  if (toInsert.length > 0) {
    await mesDb.insert(mesProductionQueue).values(toInsert);
  }
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:production-queue:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);

  if (!role || !ALLOWED_ROLES.has(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    await ensureQueueFromProgramacionOrders();

    const mesItems = await mesDb
      .select({
        id: mesProductionQueue.id,
        orderId: mesProductionQueue.orderId,
        orderItemId: mesProductionQueue.orderItemId,
        design: mesProductionQueue.design,
        size: mesProductionQueue.size,
        quantityTotal: mesProductionQueue.quantityTotal,
        priority: mesProductionQueue.priority,
        prioritySetBy: mesProductionQueue.prioritySetBy,
        prioritySetAt: mesProductionQueue.prioritySetAt,
        suggestedOrder: mesProductionQueue.suggestedOrder,
        finalOrder: mesProductionQueue.finalOrder,
        status: mesProductionQueue.status,
        confirmedAt: mesProductionQueue.confirmedAt,
        confirmedBy: mesProductionQueue.confirmedBy,
        createdAt: mesProductionQueue.createdAt,
        updatedAt: mesProductionQueue.updatedAt,
      })
      .from(mesProductionQueue)
      .where(eq(mesProductionQueue.status, "EN_COLA"))
      .orderBy(
        // URGENTE always first
        sql`case when ${mesProductionQueue.priority} = 'URGENTE' then 0 when ${mesProductionQueue.priority} = 'NORMAL' then 1 else 2 end`,
        asc(mesProductionQueue.finalOrder),
        asc(mesProductionQueue.suggestedOrder),
      )
      .limit(1_000);

    const orderIds = Array.from(new Set(mesItems.map((row) => row.orderId))).filter(Boolean);
    const confirmedByIds = Array.from(
      new Set(
        mesItems
          .map((row) => String(row.confirmedBy ?? "").trim())
          .filter(Boolean),
      ),
    );

    const erpOrders = orderIds.length
      ? await erpDb
          .select({
            id: orders.id,
            clientId: orders.clientId,
            orderCode: orders.orderCode,
            deliveryDate: orders.deliveryDate,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .where(inArray(orders.id, orderIds))
      : [];

    const orderById = new Map(erpOrders.map((row) => [row.id, row]));
    const clientIds = Array.from(
      new Set(
        erpOrders.map((row) => String(row.clientId ?? "").trim()).filter(Boolean),
      ),
    );

    const prefacturasRows = orderIds.length
      ? await erpDb
          .select({
            orderId: preInvoices.orderId,
            status: preInvoices.status,
            advanceReceived: preInvoices.advanceReceived,
            advanceStatus: preInvoices.advanceStatus,
            quotationId: preInvoices.quotationId,
          })
          .from(preInvoices)
          .where(inArray(preInvoices.orderId, orderIds))
      : [];

    const prefacturaByOrderId = new Map(prefacturasRows.map((row) => [row.orderId, row]));

    const quotationIds = Array.from(
      new Set(
        prefacturasRows
          .map((row) => String(row.quotationId ?? "").trim())
          .filter(Boolean),
      ),
    );

    const quotationsRows = quotationIds.length
      ? await erpDb
          .select({
            id: quotations.id,
            deliveryDate: quotations.deliveryDate,
            shippingEnabled: quotations.shippingEnabled,
          })
          .from(quotations)
          .where(inArray(quotations.id, quotationIds))
      : [];

    const quotationById = new Map(quotationsRows.map((row) => [row.id, row]));

    const clientsRows = clientIds.length
      ? await erpDb
          .select({ id: clients.id, name: clients.name })
          .from(clients)
          .where(inArray(clients.id, clientIds))
      : [];

    const clientById = new Map(clientsRows.map((row) => [row.id, row]));

    const employeesRows = confirmedByIds.length
      ? await erpDb
          .select({ id: employees.id, name: employees.name })
          .from(employees)
          .where(inArray(employees.id, confirmedByIds))
      : [];

    const employeeById = new Map(employeesRows.map((row) => [row.id, row]));

    const items = mesItems.map((row) => {
      const order = orderById.get(row.orderId);
      const prefactura = prefacturaByOrderId.get(row.orderId);
      const quotation = prefactura?.quotationId
        ? quotationById.get(String(prefactura.quotationId))
        : null;
      const client = order?.clientId ? clientById.get(String(order.clientId)) : null;
      const leader = row.confirmedBy
        ? employeeById.get(String(row.confirmedBy))
        : null;

      return {
        ...row,
        orderCode: order?.orderCode ?? null,
        clientName: client?.name ?? null,
        deliveryDate: order?.deliveryDate ?? quotation?.deliveryDate ?? null,
        orderCreatedAt: order?.createdAt ?? null,
        shippingEnabled: quotation?.shippingEnabled ?? null,
        accountingStatus: prefactura?.status ?? null,
        advanceReceived: prefactura?.advanceReceived ?? null,
        advanceStatus: prefactura?.advanceStatus ?? null,
        productionLeaderName: leader?.name ?? null,
      };
    });

    return Response.json({ items, truncated: items.length === 1_000 });
  } catch (error) {
    const resp = dbErrorResponse(error);

    if (resp) return resp;

    return new Response("Error al consultar cola de producción", {
      status: 500,
    });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:production-queue:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);

  if (!role || !canWrite(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const employeeId = getEmployeeIdFromRequest(request);

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const orderId = String(body.orderId ?? "").trim();
    const orderItemId = String(body.orderItemId ?? "").trim();
    const design = String(body.design ?? "").trim();
    const size = body.size ? String(body.size).trim() : null;
    const quantityTotal = Math.max(
      0,
      Math.floor(Number(body.quantityTotal ?? 0)),
    );
    const priority = PRIORITY_VALUES.includes(
      body.priority as (typeof PRIORITY_VALUES)[number],
    )
      ? (body.priority as (typeof PRIORITY_VALUES)[number])
      : "NORMAL";

    if (!orderId) return new Response("orderId es requerido", { status: 400 });
    if (!orderItemId)
      return new Response("orderItemId es requerido", { status: 400 });
    if (!design) return new Response("design es requerido", { status: 400 });

    // Calculate suggested order by delivery date (from quotation via prefactura)
    const [orderRow] = await erpDb
      .select({
        deliveryDate: sql<string | null>`coalesce(${orders.deliveryDate}, ${quotations.deliveryDate})`,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(preInvoices, eq(preInvoices.orderId, orders.id))
      .leftJoin(quotations, eq(quotations.id, preInvoices.quotationId))
      .where(eq(orders.id, orderId))
      .limit(1);

    const deliveryStr = orderRow?.deliveryDate ?? null;
    const deliveryTs = deliveryStr
      ? new Date(deliveryStr).getTime()
      : orderRow?.createdAt
        ? new Date(orderRow.createdAt).getTime()
        : Date.now();
    const suggestedOrder = Math.floor(deliveryTs / 1000);

    // Count urgent items to place URGENTE at top
    const [{ cnt }] = await mesDb
      .select({ cnt: sql<number>`count(*)::int` })
      .from(mesProductionQueue)
      .where(
        and(
          eq(mesProductionQueue.status, "EN_COLA"),
          eq(mesProductionQueue.priority, "URGENTE"),
        ),
      );

    const finalOrder =
      priority === "URGENTE" ? cnt + 1 : suggestedOrder + 1_000_000;

    const [created] = await mesDb
      .insert(mesProductionQueue)
      .values({
        orderId,
        orderItemId,
        design,
        size,
        quantityTotal,
        priority,
        prioritySetBy: priority !== "NORMAL" ? employeeId : null,
        prioritySetAt: priority !== "NORMAL" ? new Date() : null,
        suggestedOrder,
        finalOrder,
        status: "EN_COLA",
      })
      .returning();

    void createNotificationForRoles(
      ["ADMINISTRADOR", "LIDER_OPERACIONAL", "PROGRAMACION"],
      {
        title: "Diseño en cola de producción",
        message: `Diseño "${design}" agregado a la cola de producción (prioridad: ${priority}).`,
        href: `/erp/mes/production-queue`,
      },
    );

    return Response.json(created, { status: 201 });
  } catch (error) {
    const resp = dbErrorResponse(error);

    if (resp) return resp;

    return new Response("Error al crear entrada en cola de producción", {
      status: 500,
    });
  }
}
