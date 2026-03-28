import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { ORDER_ITEM_STATUS, ORDER_STATUS } from "@/src/utils/order-status";
import { db } from "@/src/db";
import {
  clients,
  employees,
  orderItemPackaging,
  orderItems,
  orders,
  prefacturas,
  quotations,
} from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import {
  ensureDateRange,
  parsePaginationStrict,
} from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

type ProcessType = "PRODUCCION" | "BODEGA" | "COMPRAS";
type OrderStatusFilter = "PRODUCCION" | "PROGRAMACION" | "APROBACION";
type ProgramacionView = "GENERAL" | "ACTUALIZACION";
type ActualizacionQueue = "APROBACION" | "PROGRAMACION";
type DeliverySort = "DEFAULT" | "MAS_PROXIMA" | "MAS_LEJANA";
type GroupByMode = "ITEM" | "ORDER";

const VALID_PROCESSES: ProcessType[] = ["PRODUCCION", "BODEGA", "COMPRAS"];
const VALID_ORDER_STATUS: OrderStatusFilter[] = [
  "PRODUCCION",
  "PROGRAMACION",
  ORDER_STATUS.APROBACION,
];
const VALID_VIEW: ProgramacionView[] = ["GENERAL", "ACTUALIZACION"];
const VALID_ACTUALIZACION_QUEUE: ActualizacionQueue[] = [
  "APROBACION",
  "PROGRAMACION",
];
const VALID_DELIVERY_SORT: DeliverySort[] = [
  "DEFAULT",
  "MAS_PROXIMA",
  "MAS_LEJANA",
];
const VALID_GROUP_BY: GroupByMode[] = ["ITEM", "ORDER"];
const PROGRAMACION_CACHE_HEADERS = {
  "Cache-Control": "no-store",
  Vary: "Cookie",
};

// Hard ceiling to prevent unbounded in-memory expansion (1 DB item → N size rows).
// With the 30-day default date window this is rarely hit in practice.
const MAX_BASE_ITEMS = 2_000;

function buildMontajeTicket(designNumber: number) {
  const next = 1000 + Math.max(1, designNumber || 1);

  return `MON-${next}`;
}

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
  const { page, pageSize, offset } = parsePaginationStrict(searchParams, {
    defaultPageSize: 20,
    maxPageSize: 100,
  });
  let dateRange: { dateFrom: string; dateTo: string };

  try {
    dateRange = ensureDateRange(searchParams, {
      defaultDays: 30,
      maxDays: 365,
      fromKey: "startDate",
      toKey: "endDate",
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : "Invalid date range.",
      { status: 400 },
    );
  }

  const processRaw = String(searchParams.get("process") ?? "PRODUCCION")
    .trim()
    .toUpperCase();
  const orderStatusRaw = String(searchParams.get("orderStatus") ?? "PRODUCCION")
    .trim()
    .toUpperCase();
  const viewRaw = String(searchParams.get("view") ?? "GENERAL")
    .trim()
    .toUpperCase();
  const actualizacionQueueRaw = String(
    searchParams.get("actualizacionQueue") ?? "PROGRAMACION",
  )
    .trim()
    .toUpperCase();
  const deliverySortRaw = String(searchParams.get("deliverySort") ?? "DEFAULT")
    .trim()
    .toUpperCase();
  const groupByRaw = String(searchParams.get("groupBy") ?? "ITEM")
    .trim()
    .toUpperCase();
  const search = String(searchParams.get("search") ?? "").trim();
  const genderRaw = String(searchParams.get("gender") ?? "")
    .trim()
    .toUpperCase();

  if (!VALID_PROCESSES.includes(processRaw as ProcessType)) {
    return new Response("process inválido. Usa: PRODUCCION, BODEGA, COMPRAS", {
      status: 400,
    });
  }

  if (!VALID_ORDER_STATUS.includes(orderStatusRaw as OrderStatusFilter)) {
    return new Response(
      "orderStatus inválido. Usa: PRODUCCION, PROGRAMACION o APROBACION",
      {
        status: 400,
      },
    );
  }

  if (!VALID_VIEW.includes(viewRaw as ProgramacionView)) {
    return new Response("view inválido. Usa: GENERAL o ACTUALIZACION", {
      status: 400,
    });
  }

  if (
    !VALID_ACTUALIZACION_QUEUE.includes(
      actualizacionQueueRaw as ActualizacionQueue,
    )
  ) {
    return new Response(
      "actualizacionQueue inválido. Usa: APROBACION o PROGRAMACION",
      {
        status: 400,
      },
    );
  }

  if (!VALID_DELIVERY_SORT.includes(deliverySortRaw as DeliverySort)) {
    return new Response(
      "deliverySort inválido. Usa: DEFAULT, MAS_PROXIMA o MAS_LEJANA",
      {
        status: 400,
      },
    );
  }

  if (!VALID_GROUP_BY.includes(groupByRaw as GroupByMode)) {
    return new Response("groupBy inválido. Usa: ITEM o ORDER", {
      status: 400,
    });
  }

  const process = processRaw as ProcessType;
  const orderStatus = orderStatusRaw as OrderStatusFilter;
  const view = viewRaw as ProgramacionView;
  const actualizacionQueue = actualizacionQueueRaw as ActualizacionQueue;
  const deliverySort = deliverySortRaw as DeliverySort;
  const groupBy = groupByRaw as GroupByMode;
  const gender =
    genderRaw === "HOMBRE" || genderRaw === "MUJER" || genderRaw === "UNISEX"
      ? genderRaw
      : "";

  const processFilter = sql`(
      case
        when upper(trim(coalesce(${orderItems.process}, ''))) in ('PRODUCCION', 'BODEGA', 'COMPRAS')
          then upper(trim(coalesce(${orderItems.process}, '')))
        else 'PRODUCCION'
      end
    ) = ${process}`;

  const whereBase = and(processFilter, eq(orders.status, orderStatus as any));

  const searchFilter = search
    ? sql`(
        ${orders.orderCode} ilike ${`%${search}%`}
        or ${clients.name} ilike ${`%${search}%`}
        or ${clients.clientCode} ilike ${`%${search}%`}
        or ${employees.name} ilike ${`%${search}%`}
        or ${orderItems.name} ilike ${`%${search}%`}
        or exists (
          select 1
          from ${orderItemPackaging} oip_search
          where oip_search.order_item_id = ${orderItems.id}
            and oip_search.size ilike ${`%${search}%`}
        )
      )`
    : undefined;

  const genderFilter = gender
    ? eq(orderItems.gender, gender as any)
    : undefined;
  const dateStartFilter = sql`date(${orders.createdAt}) >= ${dateRange.dateFrom}::date`;
  const dateEndFilter = sql`date(${orders.createdAt}) <= ${dateRange.dateTo}::date`;

  const where =
    view === "ACTUALIZACION"
      ? and(
          actualizacionQueue === "APROBACION"
            ? sql`${orderItems.status} = ${ORDER_ITEM_STATUS.APROBACION_ACTUALIZACION}`
            : sql`${orderItems.status} = ${ORDER_ITEM_STATUS.PENDIENTE_PRODUCCION_ACTUALIZACION}`,
          searchFilter,
          genderFilter,
          dateStartFilter,
          dateEndFilter,
        )
      : and(
          whereBase,
          searchFilter,
          genderFilter,
          dateStartFilter,
          dateEndFilter,
        );

  const baseItems = await db
    .select({
      id: orderItems.id,
      orderItemId: orderItems.id,
      orderId: orders.id,
      orderCode: orders.orderCode,
      orderDate: orders.createdAt,
      clientName: clients.name,
      clientCode: clients.clientCode,
      deliveryDate: sql<
        string | null
      >`coalesce((date(${orders.createdAt}) + ${orderItems.estimatedLeadDays})::text, ${quotations.deliveryDate}::text)`,
      sellerName: employees.name,
      sellerCode: employees.employeeCode,
      design: orderItems.name,
      itemStatus: orderItems.status,
      quantity: sql<number | null>`coalesce(${orderItems.quantity}, 0)`,
      fabric: orderItems.fabric,
      gender: orderItems.gender,
      leadDays: orderItems.estimatedLeadDays,
      leadHours: sql<
        number | null
      >`case when ${orderItems.estimatedLeadDays} is null then null else ${orderItems.estimatedLeadDays} * 24 end`,
      process: sql<string>`coalesce(nullif(${orderItems.process}, ''), 'PRODUCCION')`,
      ticketMontaje: orderItems.ticketMontaje,
      ticketPlotter: orderItems.ticketPlotter,
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
    .limit(MAX_BASE_ITEMS);
  const baseItemsTruncated = baseItems.length === MAX_BASE_ITEMS;
  const baseItemIds = baseItems.map((item) => item.id);

  const packagingSizes = baseItemIds.length
    ? await db
        .select({
          orderItemId: orderItemPackaging.orderItemId,
          mode: orderItemPackaging.mode,
          size: orderItemPackaging.size,
          quantity: orderItemPackaging.quantity,
          rowOrder: orderItemPackaging.id,
        })
        .from(orderItemPackaging)
        .where(inArray(orderItemPackaging.orderItemId, baseItemIds))
        .orderBy(orderItemPackaging.id)
    : [];

  const sizesByItem = new Map<
    string,
    Array<{ size: string; quantity: number; rowOrder: string }>
  >();

  const packagingRowsByItem = new Map<
    string,
    Array<{ mode: string; size: string; quantity: number; rowOrder: string }>
  >();

  for (const row of packagingSizes) {
    const itemId = String(row.orderItemId ?? "").trim();
    const mode = String(row.mode ?? "").trim().toUpperCase();
    const size = String(row.size ?? "").trim();
    const quantity = Number(row.quantity ?? 0);

    if (!itemId || !size || !Number.isFinite(quantity) || quantity <= 0)
      continue;

    const currentRows = packagingRowsByItem.get(itemId) ?? [];

    currentRows.push({
      mode,
      size,
      quantity,
      rowOrder: String(row.rowOrder ?? ""),
    });
    packagingRowsByItem.set(itemId, currentRows);
  }

  for (const [itemId, rows] of packagingRowsByItem.entries()) {
    const groupedRows = rows.filter((row) => row.mode === "AGRUPADO");
    const sourceRows = groupedRows.length > 0 ? groupedRows : rows;
    const current = sizesByItem.get(itemId) ?? [];

    for (const row of sourceRows) {
      current.push({
        size: row.size,
        quantity: row.quantity,
        rowOrder: row.rowOrder,
      });
    }

    sizesByItem.set(itemId, current);
  }

  const expandedItems: Array<{
    id: string;
    orderItemId: string;
    orderId: string;
    orderCode: string;
    orderDate: Date | null;
    clientName: string | null;
    clientCode: string | null;
    deliveryDate: string | null;
    sellerName: string | null;
    sellerCode: string | null;
    designNumber: number | null;
    design: string | null;
    ticketMontaje: string | null;
    ticketPlotter: string | null;
    talla: string | null;
    quantity: number | null;
    fabric: string | null;
    gender: string | null;
    leadDays: number | null;
    leadHours: number | null;
    process: string | null;
    itemStatus: string | null;
  }> = [];

  const splitBySize = !(view === "ACTUALIZACION" && groupBy === "ITEM");

  const itemIdsByOrder = new Map<
    string,
    Array<{ itemId: string; createdAt: Date | null }>
  >();

  for (const item of baseItems) {
    const orderId = String(item.orderId ?? "");
    const itemId = String(item.id ?? "");

    if (!orderId || !itemId) continue;

    const current = itemIdsByOrder.get(orderId) ?? [];

    current.push({ itemId, createdAt: item.itemCreatedAt ?? null });
    itemIdsByOrder.set(orderId, current);
  }

  const designNumberByItemId = new Map<string, number>();

  for (const [, rows] of itemIdsByOrder.entries()) {
    const uniqueByItemId = new Map<string, Date | null>();

    for (const row of rows) {
      if (!uniqueByItemId.has(row.itemId)) {
        uniqueByItemId.set(row.itemId, row.createdAt ?? null);
      }
    }

    const ordered = Array.from(uniqueByItemId.entries()).sort((a, b) => {
      const aTime = a[1] ? new Date(a[1]).getTime() : 0;
      const bTime = b[1] ? new Date(b[1]).getTime() : 0;

      return aTime - bTime;
    });

    ordered.forEach(([itemId], index) => {
      designNumberByItemId.set(itemId, index + 1);
    });
  }

  const assignedTicketsByItemId = new Map<
    string,
    { ticketMontaje: string | null }
  >();
  const ticketUpdates: Array<Promise<unknown>> = [];

  for (const item of baseItems) {
    const itemId = String(item.id ?? "").trim();

    if (!itemId) continue;

    const designNumber = designNumberByItemId.get(itemId) ?? 1;
    const currentTicket = String(item.ticketMontaje ?? "").trim();
    const hasExpectedFormat = /^MON-\d{4}$/i.test(currentTicket);
    const ticketMontaje = hasExpectedFormat
      ? currentTicket.toUpperCase()
      : buildMontajeTicket(designNumber);

    assignedTicketsByItemId.set(itemId, { ticketMontaje });

    if (!hasExpectedFormat) {
      ticketUpdates.push(
        db
          .update(orderItems)
          .set({ ticketMontaje })
          .where(eq(orderItems.id, item.id)),
      );
    }
  }

  if (ticketUpdates.length > 0) {
    await Promise.all(ticketUpdates);
  }

  const sizeWeight = (value: string | null | undefined) => {
    const raw = String(value ?? "")
      .trim()
      .toUpperCase();

    const mapped: Record<string, number> = {
      XXXL: 120,
      XXL: 110,
      XL: 100,
      L: 90,
      M: 80,
      S: 70,
      XS: 60,
      XXS: 50,
    };

    if (mapped[raw]) return mapped[raw];

    const numericRange = raw.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);

    if (numericRange) {
      return Number(numericRange[2]);
    }

    const numeric = raw.match(/^(\d+(?:\.\d+)?)$/);

    if (numeric) {
      return Number(numeric[1]);
    }

    return 0;
  };

  for (const item of baseItems) {
    const itemId = String(item.id);
    const sizeRows = sizesByItem.get(itemId) ?? [];
    const tickets = assignedTicketsByItemId.get(itemId);

    if (!splitBySize) {
      expandedItems.push({
        id: itemId,
        orderItemId: itemId,
        orderId: String(item.orderId),
        orderCode: String(item.orderCode ?? ""),
        orderDate: item.orderDate,
        clientName: item.clientName,
        clientCode: item.clientCode,
        deliveryDate: item.deliveryDate,
        sellerName: item.sellerName,
        sellerCode: item.sellerCode,
        designNumber: designNumberByItemId.get(itemId) ?? null,
        design: item.design,
        ticketMontaje: tickets?.ticketMontaje ?? null,
        ticketPlotter: item.ticketPlotter ?? null,
        talla: null,
        quantity: item.quantity,
        fabric: item.fabric,
        gender: item.gender,
        leadDays: item.leadDays,
        leadHours: item.leadHours,
        process: item.process,
        itemStatus: item.itemStatus,
      });
      continue;
    }

    if (sizeRows.length === 0) {
      expandedItems.push({
        id: itemId,
        orderItemId: itemId,
        orderId: String(item.orderId),
        orderCode: String(item.orderCode ?? ""),
        orderDate: item.orderDate,
        clientName: item.clientName,
        clientCode: item.clientCode,
        deliveryDate: item.deliveryDate,
        sellerName: item.sellerName,
        sellerCode: item.sellerCode,
        designNumber: designNumberByItemId.get(itemId) ?? null,
        design: item.design,
        ticketMontaje: tickets?.ticketMontaje ?? null,
        ticketPlotter: item.ticketPlotter ?? null,
        talla: null,
        quantity: item.quantity,
        fabric: item.fabric,
        gender: item.gender,
        leadDays: item.leadDays,
        leadHours: item.leadHours,
        process: item.process,
        itemStatus: item.itemStatus,
      });
      continue;
    }

    sizeRows.sort((a, b) => {
      const weight = sizeWeight(b.size) - sizeWeight(a.size);

      if (weight !== 0) return weight;

      return b.rowOrder.localeCompare(a.rowOrder);
    });

    sizeRows.forEach((sizeRow, index) => {
      expandedItems.push({
        id: `${itemId}:${index + 1}`,
        orderItemId: itemId,
        orderId: String(item.orderId),
        orderCode: String(item.orderCode ?? ""),
        orderDate: item.orderDate,
        clientName: item.clientName,
        clientCode: item.clientCode,
        deliveryDate: item.deliveryDate,
        sellerName: item.sellerName,
        sellerCode: item.sellerCode,
        designNumber: designNumberByItemId.get(itemId) ?? null,
        design: item.design,
        ticketMontaje: tickets?.ticketMontaje ?? null,
        ticketPlotter: item.ticketPlotter ?? null,
        talla: sizeRow.size,
        quantity: sizeRow.quantity,
        fabric: item.fabric,
        gender: item.gender,
        leadDays: item.leadDays,
        leadHours: item.leadHours,
        process: item.process,
        itemStatus: item.itemStatus,
      });
    });
  }

  if (deliverySort !== "DEFAULT") {
    expandedItems.sort((a, b) => {
      const aTime = a.deliveryDate
        ? new Date(a.deliveryDate).getTime()
        : Number.POSITIVE_INFINITY;
      const bTime = b.deliveryDate
        ? new Date(b.deliveryDate).getTime()
        : Number.POSITIVE_INFINITY;

      if (deliverySort === "MAS_PROXIMA") {
        return aTime - bTime;
      }

      return bTime - aTime;
    });
  }

  const groupedItems =
    groupBy === "ORDER"
      ? (() => {
          const byOrder = new Map<
            string,
            {
              id: string;
              orderItemId: string;
              orderItemIds: string[];
              orderId: string;
              orderCode: string;
              orderDate: Date | null;
              clientName: string | null;
              clientCode: string | null;
              deliveryDate: string | null;
              sellerName: string | null;
              sellerCode: string | null;
              designNumber: number | null;
              design: string | null;
              ticketMontaje: string | null;
              ticketPlotter: string | null;
              talla: string | null;
              quantity: number | null;
              fabric: string | null;
              gender: string | null;
              leadDays: number | null;
              leadHours: number | null;
              process: string | null;
              itemStatus: string | null;
            }
          >();

          for (const row of expandedItems) {
            const key = String(row.orderId || row.orderCode || row.id);
            const current = byOrder.get(key);

            if (!current) {
              byOrder.set(key, {
                ...row,
                id: key,
                orderItemId: row.orderItemId,
                orderItemIds: [row.orderItemId],
                designNumber: null,
                design: null,
                ticketMontaje: null,
                ticketPlotter: null,
                talla: null,
                quantity: Number(row.quantity ?? 0),
              });
              continue;
            }

            if (!current.orderItemIds.includes(row.orderItemId)) {
              current.orderItemIds.push(row.orderItemId);
            }

            current.quantity =
              Number(current.quantity ?? 0) + Number(row.quantity ?? 0);

            if (!current.deliveryDate) {
              current.deliveryDate = row.deliveryDate;
            } else if (row.deliveryDate) {
              const currentTs = new Date(current.deliveryDate).getTime();
              const nextTs = new Date(row.deliveryDate).getTime();

              if (
                !Number.isNaN(nextTs) &&
                (Number.isNaN(currentTs) || nextTs < currentTs)
              ) {
                current.deliveryDate = row.deliveryDate;
              }
            }
          }

          return Array.from(byOrder.values());
        })()
      : expandedItems;

  const total = groupedItems.length;
  const items = groupedItems.slice(offset, offset + pageSize);

  const hasNextPage = offset + items.length < total;

  return Response.json(
    {
      items,
      page,
      pageSize,
      total,
      hasNextPage,
      truncated: baseItemsTruncated,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
    },
    {
      headers: PROGRAMACION_CACHE_HEADERS,
    },
  );
}
