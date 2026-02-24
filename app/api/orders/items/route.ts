import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  employees,
  inventoryItems,
  orderItemMaterials,
  orderItemPackaging,
  orderItemSocks,
  orderItemStatusHistory,
  orderItems,
  orders,
  products,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { createNotificationsForPermission } from "@/src/utils/notifications";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { getLatestUsdCopRate } from "@/src/utils/exchange-rate";

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

async function recalcOrderTotal(tx: any, orderId: string) {
  const [{ subtotal }] = await tx
    .select({
      subtotal: sql<string>`coalesce(sum(coalesce(${orderItems.totalPrice}, ${orderItems.unitPrice} * ${orderItems.quantity})), 0)::text`,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const [o] = await tx
    .select({ discount: orders.discount })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  const discountPercent = Math.min(100, Math.max(0, asNumber(o?.discount)));
  const subtotalNumber = asNumber(subtotal);
  const totalAfterDiscount = subtotalNumber * (1 - discountPercent / 100);

  await tx
    .update(orders)
    .set({ total: String(totalAfterDiscount) })
    .where(eq(orders.id, orderId));
}

function toNullableString(v: unknown) {
  const s = String(v ?? "").trim();

  return s ? s : null;
}

function toNullableNumericString(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));

  if (Number.isNaN(n)) return null;

  return String(n);
}

function toPositiveInt(v: unknown) {
  const n = Number(String(v));

  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);

  return i > 0 ? i : null;
}

function pickCopScaleByQuantity(
  row: typeof products.$inferSelect,
  quantity: number,
) {
  if (quantity <= 499) return row.priceCopR1;
  if (quantity <= 1000) return row.priceCopR2;

  return row.priceCopR3;
}

function resolveUnitPriceByRule(args: {
  currency: string | null | undefined;
  clientPriceType: string | null | undefined;
  quantity: number;
  row: typeof products.$inferSelect;
  manualUnitPrice?: unknown;
  usdCopEffectiveRate?: number | null;
}) {
  const {
    currency,
    clientPriceType,
    quantity,
    row,
    manualUnitPrice,
    usdCopEffectiveRate,
  } = args;

  const currencyCode = String(currency ?? "COP").toUpperCase();
  const manual = toNullableNumericString(manualUnitPrice);

  if (clientPriceType === "AUTORIZADO" && manual) {
    return manual;
  }

  if (currencyCode === "USD") {
    if (row.priceUSD) return row.priceUSD;

    if (row.priceCopInternational && usdCopEffectiveRate && usdCopEffectiveRate > 0) {
      return String(asNumber(row.priceCopInternational) / usdCopEffectiveRate);
    }

    return null;
  }

  if (clientPriceType === "VIOMAR" && row.priceViomar) return row.priceViomar;
  if (clientPriceType === "COLANTA" && row.priceColanta) return row.priceColanta;
  if (clientPriceType === "MAYORISTA" && row.priceMayorista) return row.priceMayorista;

  const copByScale = pickCopScaleByQuantity(row, quantity);

  if (copByScale) return copByScale;

  if (row.priceCopInternational) return row.priceCopInternational;

  if (row.priceUSD && usdCopEffectiveRate && usdCopEffectiveRate > 0) {
    return String(asNumber(row.priceUSD) * usdCopEffectiveRate);
  }

  return null;
}

async function resolveEmployeeId(request: Request) {
  const direct = getEmployeeIdFromRequest(request);

  if (direct) return direct;

  const userId = getUserIdFromRequest(request);

  if (!userId) return null;

  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1);

  return row?.id ?? null;
}

async function assertAdvisorOrderAccess(request: Request, orderId: string) {
  const role = getRoleFromRequest(request);

  if (role !== "ASESOR") return null;

  const employeeId = await resolveEmployeeId(request);

  if (!employeeId) return new Response("Forbidden", { status: 403 });

  const [orderRow] = await db
    .select({ createdBy: orders.createdBy })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderRow) return new Response("Not found", { status: 404 });

  if (orderRow.createdBy !== employeeId) {
    return new Response("Forbidden", { status: 403 });
  }

  return null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "order-items:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const orderId = String(searchParams.get("orderId") ?? "").trim();

  if (!orderId) {
    return new Response("orderId required", { status: 400 });
  }

  const advisorForbidden = await assertAdvisorOrderAccess(request, orderId);

  if (advisorForbidden) return advisorForbidden;

  const where = and(eq(orderItems.orderId, orderId));

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(orderItems)
    .where(where);

  const items = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      name: orderItems.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
      imageUrl: orderItems.imageUrl,
      status: orderItems.status,
      lastStatusAt: sql<string | null>`(
        select oish.created_at
        from order_item_status_history oish
        where oish.order_item_id = ${sql.raw('"order_items"."id"')}
        order by oish.created_at desc
        limit 1
      )`,
      lastStatusBy: sql<string | null>`(
        select e.name
        from order_item_status_history oish
        left join employees e on e.id = oish.changed_by
        where oish.order_item_id = ${sql.raw('"order_items"."id"')}
        order by oish.created_at desc
        limit 1
      )`,
      createdAt: orderItems.createdAt,
      confectionistName: sql<string | null>`(
        select c.name
        from order_item_confection oic
        join confectionists c on c.id = oic.confectionist_id
        where oic.order_item_id = ${sql.raw('"order_items"."id"')}
          and oic.finished_at is null
        order by oic.assigned_at desc
        limit 1
      )`,
    })
    .from(orderItems)
    .where(where)
    .orderBy(desc(orderItems.createdAt))
    .limit(pageSize)
    .offset(offset);

  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "order-items:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const body = (await request.json()) as any;

  const orderId = String(body.orderId ?? "").trim();

  if (!orderId) return new Response("orderId required", { status: 400 });

  const advisorForbidden = await assertAdvisorOrderAccess(request, orderId);

  if (advisorForbidden) return advisorForbidden;

  const qty = toPositiveInt(body.quantity);

  if (!qty) return new Response("quantity must be positive", { status: 400 });

  const employeeId = await resolveEmployeeId(request);
  const latestUsdCopRate = await getLatestUsdCopRate();

  let created: typeof orderItems.$inferSelect | undefined;

  try {
    created = await db.transaction(async (tx) => {
    const [orderRow] = await tx
      .select({
        kind: orders.kind,
        currency: orders.currency,
        clientPriceType: clients.priceClientType,
      })
      .from(orders)
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!orderRow) throw new Error("order not found");

    // COMPLETACION: no se permite agregar nuevos diseños
    if (orderRow.kind === "COMPLETACION") {
      throw new Error(
        "No se pueden agregar diseños en pedidos de completación",
      );
    }

    const productId = toNullableString(body.productId);

    if (!productId) {
      throw new Error("productId required");
    }

    const [productRow] = await tx
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!productRow || productRow.isActive === false) {
      throw new Error("producto requerido");
    }

    const resolvedUnitPrice = resolveUnitPriceByRule({
      currency: orderRow.currency,
      clientPriceType: orderRow.clientPriceType,
      quantity: qty,
      row: productRow,
      manualUnitPrice: body.unitPrice,
      usdCopEffectiveRate: latestUsdCopRate?.effectiveRate ?? null,
    });

    if (!resolvedUnitPrice) {
      throw new Error("No hay precio aplicable para este cliente y cantidad");
    }

    const unitPrice = Math.max(0, asNumber(resolvedUnitPrice));

    const [oi] = await tx
      .insert(orderItems)
      .values({
        orderId,
        productId,
        name: toNullableString(body.name),
        quantity: qty,
        unitPrice: String(unitPrice),
        totalPrice: String(unitPrice * qty),
        observations: toNullableString(body.observations),
        fabric: toNullableString(body.fabric),
        imageUrl: toNullableString(body.imageUrl),
        screenPrint: Boolean(body.screenPrint ?? false),
        embroidery: Boolean(body.embroidery ?? false),
        buttonhole: Boolean(body.buttonhole ?? false),
        snap: Boolean(body.snap ?? false),
        tag: Boolean(body.tag ?? false),
        flag: Boolean(body.flag ?? false),
        gender: toNullableString(body.gender),
        process: toNullableString(body.process),
        neckType: toNullableString(body.neckType),
        sleeve: toNullableString(body.sleeve),
        color: toNullableString(body.color),
        requiresSocks: Boolean(body.requiresSocks ?? false),
        isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        manufacturingId: toNullableString(body.manufacturingId),
        status: "PENDIENTE" as any,
        requiresRevision: false,
      } as any)
      .returning();

    const orderItemId = oi!.id;

    await tx.insert(orderItemStatusHistory).values({
      orderItemId,
      status: (oi as any)?.status ?? "PENDIENTE",
      changedBy: employeeId,
    });

    const packaging = Array.isArray(body.packaging) ? body.packaging : [];

    if (packaging.length > 0) {
      await tx.insert(orderItemPackaging).values(
        packaging.map((p: any) => ({
          orderItemId,
          mode: String(p.mode ?? "AGRUPADO"),
          size: String(p.size ?? ""),
          quantity: p.quantity === undefined ? null : toPositiveInt(p.quantity),
          personName: toNullableString(p.personName),
          personNumber: toNullableString(p.personNumber),
        })) as any,
      );
    }

    const socks = Array.isArray(body.socks) ? body.socks : [];

    if (socks.length > 0) {
      await tx.insert(orderItemSocks).values(
        socks.map((s: any) => ({
          orderItemId,
          size: String(s.size ?? ""),
          quantity: s.quantity === undefined ? null : toPositiveInt(s.quantity),
          description: toNullableString(s.description),
          imageUrl: toNullableString(s.imageUrl),
        })) as any,
      );
    }

    const materials = Array.isArray(body.materials) ? body.materials : [];

    if (materials.length > 0) {
      const inventoryIds = materials
        .map((m: any) => String(m.inventoryItemId ?? "").trim())
        .filter(Boolean);

      const existingInv = inventoryIds.length
        ? await tx
            .select({ id: inventoryItems.id })
            .from(inventoryItems)
            .where(inArray(inventoryItems.id, inventoryIds))
        : [];

      const existingSet = new Set(existingInv.map((r) => r.id));

      await tx.insert(orderItemMaterials).values(
        materials
          .map((m: any) => ({
            orderItemId,
            inventoryItemId: String(m.inventoryItemId ?? "").trim(),
            quantity: toNullableNumericString(m.quantity),
            note: toNullableString(m.note),
          }))
          .filter((m: any) => existingSet.has(m.inventoryItemId)) as any,
      );
    }

    await recalcOrderTotal(tx, orderId);

    return oi;
  });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear el diseño";

    if (
      message.includes("required") ||
      message.includes("vigente") ||
      message.includes("aplicable") ||
      message.includes("completación")
    ) {
      return new Response(message, { status: 400 });
    }

    return new Response("No se pudo crear el diseño", { status: 500 });
  }

  await createNotificationsForPermission("VER_DISEÑO", {
    title: "Diseño creado",
    message: `Se creó el diseño ${created?.name ?? "(sin nombre)"}.`,
    href: `/orders/${orderId}/items/${created?.id}`,
  });

  return Response.json(created, { status: 201 });
}
