import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  employees,
  orderItemPackaging,
  orderItemSocks,
  orderItems,
  orders,
  prefacturas,
  quotations,
} from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

type ProcessType = "PRODUCCION" | "BODEGA" | "COMPRAS";
type OrderStatusFilter = "PRODUCCION" | "APROBACION_INICIAL";

const VALID_PROCESSES: ProcessType[] = ["PRODUCCION", "BODEGA", "COMPRAS"];
const VALID_ORDER_STATUS: OrderStatusFilter[] = ["PRODUCCION", "APROBACION_INICIAL"];

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "programacion:items:get",
    limit: 180,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const processRaw = String(searchParams.get("process") ?? "PRODUCCION")
    .trim()
    .toUpperCase();
  const orderStatusRaw = String(searchParams.get("orderStatus") ?? "PRODUCCION")
    .trim()
    .toUpperCase();

  if (!VALID_PROCESSES.includes(processRaw as ProcessType)) {
    return new Response("process inválido. Usa: PRODUCCION, BODEGA, COMPRAS", {
      status: 400,
    });
  }

  if (!VALID_ORDER_STATUS.includes(orderStatusRaw as OrderStatusFilter)) {
    return new Response("orderStatus inválido. Usa: PRODUCCION o APROBACION_INICIAL", {
      status: 400,
    });
  }

  const process = processRaw as ProcessType;
  const orderStatus = orderStatusRaw as OrderStatusFilter;

  const where = and(
    sql`coalesce(nullif(${orderItems.process}, ''), 'PRODUCCION') = ${process}`,
    eq(orders.status, orderStatus as any),
  );

  const baseItems = await db
    .select({
      id: orderItems.id,
      orderId: orders.id,
      orderCode: orders.orderCode,
      orderDate: orders.createdAt,
      clientName: clients.name,
      deliveryDate: sql<string | null>`coalesce((date(${orders.createdAt}) + ${orderItems.estimatedLeadDays})::text, ${quotations.deliveryDate}::text)`,
      sellerName: employees.name,
      design: orderItems.name,
      quantity: sql<number | null>`coalesce(${orderItems.quantity}, 0)`,
      fabric: orderItems.fabric,
      gender: orderItems.gender,
      leadDays: orderItems.estimatedLeadDays,
      leadHours: sql<number | null>`case when ${orderItems.estimatedLeadDays} is null then null else ${orderItems.estimatedLeadDays} * 24 end`,
      process: sql<string>`coalesce(nullif(${orderItems.process}, ''), 'PRODUCCION')`,
      itemCreatedAt: orderItems.createdAt,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .leftJoin(employees, eq(orders.createdBy, employees.id))
    .leftJoin(prefacturas, eq(prefacturas.orderId, orders.id))
    .leftJoin(quotations, eq(quotations.id, prefacturas.quotationId))
    .where(where)
    .orderBy(desc(orders.createdAt), desc(orderItems.createdAt))
    ;

  const baseItemIds = baseItems.map((item) => item.id);

  const packagingSizes = baseItemIds.length
    ? await db
        .select({
          orderItemId: orderItemPackaging.orderItemId,
          size: orderItemPackaging.size,
          quantity: orderItemPackaging.quantity,
          rowOrder: orderItemPackaging.id,
        })
        .from(orderItemPackaging)
        .where(inArray(orderItemPackaging.orderItemId, baseItemIds))
        .orderBy(orderItemPackaging.id)
    : [];

  const socksSizes = baseItemIds.length
    ? await db
        .select({
          orderItemId: orderItemSocks.orderItemId,
          size: orderItemSocks.size,
          quantity: orderItemSocks.quantity,
          rowOrder: orderItemSocks.id,
        })
        .from(orderItemSocks)
        .where(inArray(orderItemSocks.orderItemId, baseItemIds))
        .orderBy(orderItemSocks.id)
    : [];

  const sizesByItem = new Map<
    string,
    Array<{ size: string; quantity: number; rowOrder: string }>
  >();

  for (const row of [...packagingSizes, ...socksSizes]) {
    const itemId = String(row.orderItemId ?? "").trim();
    const size = String(row.size ?? "").trim();
    const quantity = Number(row.quantity ?? 0);

    if (!itemId || !size || !Number.isFinite(quantity) || quantity <= 0) continue;

    const current = sizesByItem.get(itemId) ?? [];
    current.push({ size, quantity, rowOrder: String(row.rowOrder ?? "") });
    sizesByItem.set(itemId, current);
  }

  const expandedItems: Array<{
    id: string;
    orderId: string;
    orderCode: string;
    orderDate: Date | null;
    clientName: string | null;
    deliveryDate: string | null;
    sellerName: string | null;
    design: string | null;
    talla: string | null;
    quantity: number | null;
    fabric: string | null;
    gender: string | null;
    leadDays: number | null;
    leadHours: number | null;
    process: string | null;
  }> = [];

  for (const item of baseItems) {
    const itemId = String(item.id);
    const sizeRows = sizesByItem.get(itemId) ?? [];

    if (sizeRows.length === 0) {
      expandedItems.push({
        id: itemId,
        orderId: String(item.orderId),
        orderCode: String(item.orderCode ?? ""),
        orderDate: item.orderDate,
        clientName: item.clientName,
        deliveryDate: item.deliveryDate,
        sellerName: item.sellerName,
        design: item.design,
        talla: null,
        quantity: item.quantity,
        fabric: item.fabric,
        gender: item.gender,
        leadDays: item.leadDays,
        leadHours: item.leadHours,
        process: item.process,
      });
      continue;
    }

    sizeRows.sort((a, b) => a.rowOrder.localeCompare(b.rowOrder));

    sizeRows.forEach((sizeRow, index) => {
      expandedItems.push({
        id: `${itemId}:${index + 1}`,
        orderId: String(item.orderId),
        orderCode: String(item.orderCode ?? ""),
        orderDate: item.orderDate,
        clientName: item.clientName,
        deliveryDate: item.deliveryDate,
        sellerName: item.sellerName,
        design: item.design,
        talla: sizeRow.size,
        quantity: sizeRow.quantity,
        fabric: item.fabric,
        gender: item.gender,
        leadDays: item.leadDays,
        leadHours: item.leadHours,
        process: item.process,
      });
    });
  }

  const total = expandedItems.length;
  const items = expandedItems.slice(offset, offset + pageSize);

  const hasNextPage = offset + items.length < total;

  return Response.json({
    items,
    page,
    pageSize,
    total,
    hasNextPage,
  });
}
