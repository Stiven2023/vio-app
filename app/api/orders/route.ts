import { and, desc, eq, ilike, inArray, like, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  employees,
  inventoryOutputs,
  orderItemConfection,
  orderItemMaterials,
  orderItemPackaging,
  orderItemRevisions,
  orderItemSocks,
  orderItemStatusHistory,
  orderItems,
  orders,
  orderPayments,
  orderStatusHistory,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { createNotificationsForPermission } from "@/src/utils/notifications";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

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

function toNonNegativeNumericString(v: unknown) {
  const raw = toNullableNumericString(v);
  const n = raw ? Number(raw) : 0;

  if (!Number.isFinite(n)) return "0";

  return String(Math.max(0, n));
}

function toDiscountPercent(v: unknown) {
  const raw = toNullableNumericString(v);
  const n = raw ? Number(raw) : 0;

  if (!Number.isFinite(n)) return 0;

  return Math.min(100, Math.max(0, n));
}

function toPositiveInt(v: unknown) {
  const n = Number(String(v));

  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);

  return i > 0 ? i : null;
}

function isUniqueViolation(e: unknown) {
  const code = (e as any)?.code;

  return code === "23505";
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

async function generateOrderCode(tx: any, type: "VN" | "VI"): Promise<string> {
  const prefix = `${type}-`;
  const seqLen = type === "VN" ? 6 : 4;

  // Soporta formatos históricos (VN-YYYYMMDD-000001) y el nuevo (vn-000001).
  // Mantiene un consecutivo por tipo, sin reiniciarse por fecha.
  const pattern = `(?i)^${type}-(?:[0-9]{8}-)?([0-9]+)$`;

  const [row] = await tx
    .select({
      maxSeq: sql<number>`max((substring(${orders.orderCode} from ${pattern})::int))`,
    })
    .from(orders)
    .where(ilike(orders.orderCode, `${type}-%`))
    .limit(1);

  const maxSeq = Number(row?.maxSeq ?? 0);
  const nextSeq = Number.isFinite(maxSeq) ? maxSeq + 1 : 1;

  return `${prefix}${String(nextSeq).padStart(seqLen, "0")}`;
}

async function insertOrderStatusHistory(
  tx: any,
  orderId: string,
  status: string,
  changedBy: string | null,
) {
  await tx.insert(orderStatusHistory).values({
    orderId,
    status: status as any,
    changedBy,
  });
}

async function insertOrderItemStatusHistory(
  tx: any,
  items: Array<{ id: string; status: string | null }> | null | undefined,
  changedBy: string | null,
) {
  if (!items || items.length === 0) return;

  await tx.insert(orderItemStatusHistory).values(
    items.map((item) => ({
      orderItemId: item.id,
      status: (item.status ?? "PENDIENTE") as any,
      changedBy,
    })),
  );
}

type OrderItemInput = {
  productId?: string | null;
  name?: string | null;
  quantity: number;
  unitPrice?: string | number | null;
};

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "orders:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const q = String(searchParams.get("q") ?? "").trim();
  const status = String(searchParams.get("status") ?? "").trim();

  const filters = [
    q ? ilike(orders.orderCode, `%${q}%`) : undefined,
    status && status !== "all" ? eq(orders.status, status as any) : undefined,
  ].filter(Boolean) as Array<ReturnType<typeof ilike>>;

  const where = filters.length ? and(...filters) : undefined;

  const totalQuery = db
    .select({ total: sql<number>`count(distinct ${orders.id})::int` })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id));

  const [{ total }] = where ? await totalQuery.where(where) : await totalQuery;

  const itemsQuery = db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      kind: (orders as any).kind,
      sourceOrderId: (orders as any).sourceOrderId,
      sourceOrderCode: sql<
        string | null
      >`(select o2.order_code from orders o2 where o2.id = ${(orders as any).sourceOrderId})`,
      clientId: orders.clientId,
      clientName: clients.name,
      type: orders.type,
      status: orders.status,
      total: orders.total,
      ivaEnabled: orders.ivaEnabled,
      discount: orders.discount,
      currency: orders.currency,
      shippingFee: (orders as any).shippingFee,
      paidTotal: sql<string>`coalesce((select sum(op.amount) from order_payments op where op.order_id = ${orders.id} and op.status <> 'ANULADO'), 0)::text`,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset(offset);

  const items = where ? await itemsQuery.where(where) : await itemsQuery;

  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "orders:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PEDIDO");

  if (forbidden) return forbidden;

  const {
    clientId,
    type,
    kind,
    sourceOrderCode,
    status,
    ivaEnabled,
    discount,
    currency,
    shippingFee,
    items,
  } = await request.json();

  const normalizedType = String(type ?? "VN")
    .trim()
    .toUpperCase();
  const orderType = (normalizedType === "VI" ? "VI" : "VN") as "VN" | "VI";

  const normalizedKind = String(kind ?? "NUEVO")
    .trim()
    .toUpperCase();
  const orderKind =
    normalizedKind === "COMPLETACION"
      ? "COMPLETACION"
      : normalizedKind === "REFERENTE"
        ? "REFERENTE"
        : "NUEVO";

  const srcCode = String(sourceOrderCode ?? "").trim();

  const itemInputs: OrderItemInput[] = Array.isArray(items) ? items : [];

  const employeeId = await resolveEmployeeId(request);

  const created = await db.transaction(async (tx) => {
    let sourceOrderId: string | null = null;

    if (orderKind !== "NUEVO") {
      if (!srcCode) {
        throw new Error("sourceOrderCode required");
      }

      const [src] = await tx
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.orderCode, srcCode))
        .limit(1);

      if (!src) {
        throw new Error("source order not found");
      }

      sourceOrderId = src.id as any;
    }

    let createdOrder: Array<typeof orders.$inferSelect> | null = null;

    const discountPercent = toDiscountPercent(discount);

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await generateOrderCode(tx, orderType);

      try {
        const result = await tx
          .insert(orders)
          .values({
            orderCode: code,
            clientId: toNullableString(clientId),
            type: orderType as any,
            kind: orderKind as any,
            sourceOrderId: sourceOrderId as any,
            status: String(status ?? "PENDIENTE") as any,
            ivaEnabled: Boolean(ivaEnabled ?? false),
            discount: String(discountPercent),
            currency: String(currency ?? "COP"),
            shippingFee: toNonNegativeNumericString(shippingFee),
            total: "0",
            createdBy: employeeId,
          })
          .returning();

        createdOrder = Array.isArray(result) ? result : [result];

        break;
      } catch (e) {
        if (!isUniqueViolation(e) || attempt === 4) throw e;
      }
    }

    if (!createdOrder || createdOrder.length === 0) {
      throw new Error("failed to create order");
    }

    const orderId = createdOrder[0]!.id;

    await insertOrderStatusHistory(
      tx,
      orderId,
      String(createdOrder[0]!.status ?? "PENDIENTE"),
      employeeId,
    );

    // Copy/paste real: COMPLETACION/REFERENTE clonan los diseños del pedido origen.
    if (orderKind !== "NUEVO" && sourceOrderId) {
      const srcItems = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, sourceOrderId as any));

      for (const src of srcItems) {
        const [newItem] = await tx
          .insert(orderItems)
          .values({
            orderId,
            productId: (src as any).productId ?? null,
            name: (src as any).name ?? null,
            quantity: (src as any).quantity,
            unitPrice: (src as any).unitPrice ?? null,
            totalPrice: (src as any).totalPrice ?? null,
            observations: (src as any).observations ?? null,
            fabric: (src as any).fabric ?? null,
            imageUrl: (src as any).imageUrl ?? null,
            screenPrint: Boolean((src as any).screenPrint ?? false),
            embroidery: Boolean((src as any).embroidery ?? false),
            buttonhole: Boolean((src as any).buttonhole ?? false),
            snap: Boolean((src as any).snap ?? false),
            tag: Boolean((src as any).tag ?? false),
            flag: Boolean((src as any).flag ?? false),
            gender: (src as any).gender ?? null,
            process: (src as any).process ?? null,
            neckType: (src as any).neckType ?? null,
            sleeve: (src as any).sleeve ?? null,
            color: (src as any).color ?? null,
            requiresSocks: Boolean((src as any).requiresSocks ?? false),
            isActive:
              (src as any).isActive === undefined
                ? true
                : Boolean((src as any).isActive),
            manufacturingId: (src as any).manufacturingId ?? null,
            status: (src as any).status ?? ("PENDIENTE" as any),
            requiresRevision: Boolean((src as any).requiresRevision ?? false),
          } as any)
          .returning();

        const newOrderItemId = (newItem as any)?.id;
        const srcOrderItemId = (src as any)?.id;

        if (!newOrderItemId || !srcOrderItemId) continue;

        await insertOrderItemStatusHistory(tx, [
          {
            id: newOrderItemId,
            status: String((newItem as any)?.status ?? "PENDIENTE"),
          },
        ], employeeId);

        const srcPackaging = await tx
          .select()
          .from(orderItemPackaging)
          .where(eq(orderItemPackaging.orderItemId, srcOrderItemId));

        if (srcPackaging.length > 0) {
          await tx.insert(orderItemPackaging).values(
            srcPackaging.map((p: any) => ({
              orderItemId: newOrderItemId,
              mode: String(p.mode ?? "AGRUPADO"),
              size: String(p.size ?? ""),
              quantity: p.quantity ?? null,
              personName: p.personName ?? null,
              personNumber: p.personNumber ?? null,
            })) as any,
          );
        }

        const srcSocks = await tx
          .select()
          .from(orderItemSocks)
          .where(eq(orderItemSocks.orderItemId, srcOrderItemId));

        if (srcSocks.length > 0) {
          await tx.insert(orderItemSocks).values(
            srcSocks.map((s: any) => ({
              orderItemId: newOrderItemId,
              size: String(s.size ?? ""),
              quantity: s.quantity ?? null,
              description: s.description ?? null,
              imageUrl: s.imageUrl ?? null,
            })) as any,
          );
        }

        const srcMaterials = await tx
          .select()
          .from(orderItemMaterials)
          .where(eq(orderItemMaterials.orderItemId, srcOrderItemId));

        if (srcMaterials.length > 0) {
          await tx.insert(orderItemMaterials).values(
            srcMaterials.map((m: any) => ({
              orderItemId: newOrderItemId,
              inventoryItemId: m.inventoryItemId,
              quantity: m.quantity ?? null,
              note: m.note ?? null,
            })) as any,
          );
        }
      }

      // Recalcular total del pedido en base a los diseños clonados
      const [{ subtotal }] = await tx
        .select({
          subtotal: sql<string>`coalesce(sum(coalesce(${orderItems.totalPrice}, ${orderItems.unitPrice} * ${orderItems.quantity})), 0)::text`,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      const subtotalNumber = Number(subtotal ?? 0);
      const totalAfterDiscount =
        (Number.isFinite(subtotalNumber) ? subtotalNumber : 0) *
        (1 - discountPercent / 100);

      await tx
        .update(orders)
        .set({ total: String(totalAfterDiscount) })
        .where(eq(orders.id, orderId));

      return createdOrder[0]!;
    }

    let subtotal = 0;

    if (itemInputs.length > 0) {
      const normalizedItems = itemInputs.map((it) => {
        const qty = toPositiveInt(it.quantity);

        if (!qty) {
          throw new Error("quantity must be positive");
        }

        const unit = toNullableNumericString(it.unitPrice);
        const unitNumber = unit ? Number(unit) : 0;
        const totalNumber = unitNumber * qty;

        subtotal += totalNumber;

        return {
          orderId,
          productId: toNullableString(it.productId),
          name: toNullableString(it.name),
          quantity: qty,
          unitPrice: unit,
          totalPrice: String(totalNumber),
          status: "PENDIENTE" as any,
          requiresRevision: false,
        };
      });

      const inserted = await tx
        .insert(orderItems)
        .values(normalizedItems as any)
        .returning({ id: orderItems.id, status: orderItems.status });

      await insertOrderItemStatusHistory(tx, inserted as any, employeeId);
    }

    const totalAfterDiscount = subtotal * (1 - discountPercent / 100);

    await tx
      .update(orders)
      .set({ total: String(totalAfterDiscount) })
      .where(eq(orders.id, orderId));

    return createdOrder[0]!;
  });

  await createNotificationsForPermission("VER_PEDIDO", {
    title: "Pedido creado",
    message: `Se creó el pedido ${created.orderCode}.`,
    href: `/orders/${created.id}/detail`,
  });

  return Response.json(created, { status: 201 });
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "orders:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const {
    id,
    orderCode,
    clientId,
    type,
    kind,
    sourceOrderCode,
    status,
    ivaEnabled,
    discount,
    currency,
    shippingFee,
    items,
  } = await request.json();

  if (!id) {
    return new Response("Order ID required", { status: 400 });
  }

  if (orderCode !== undefined) {
    return new Response(
      "orderCode is generated automatically and cannot be changed",
      {
        status: 400,
      },
    );
  }

  const forbiddenEdit = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbiddenEdit) return forbiddenEdit;

  if (status !== undefined) {
    const forbiddenStatus = await requirePermission(
      request,
      "CAMBIAR_ESTADO_PEDIDO",
    );

    if (forbiddenStatus) return forbiddenStatus;
  }

  const patch: Partial<typeof orders.$inferInsert> = {};

  if (clientId !== undefined) patch.clientId = toNullableString(clientId);
  if (type !== undefined) patch.type = String(type) as any;
  if (kind !== undefined) patch.kind = String(kind) as any;
  if (sourceOrderCode !== undefined) {
    const srcCode = String(sourceOrderCode ?? "").trim();
    const normalizedKind = String(kind ?? "")
      .trim()
      .toUpperCase();
    const nextKind =
      normalizedKind === "COMPLETACION"
        ? "COMPLETACION"
        : normalizedKind === "REFERENTE"
          ? "REFERENTE"
          : normalizedKind === "NUEVO"
            ? "NUEVO"
            : undefined;

    if (nextKind && nextKind !== "NUEVO") {
      if (!srcCode) {
        return new Response("sourceOrderCode required", { status: 400 });
      }

      const [src] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.orderCode, srcCode))
        .limit(1);

      if (!src) {
        return new Response("source order not found", { status: 400 });
      }

      (patch as any).sourceOrderId = src.id;
    } else {
      (patch as any).sourceOrderId = null;
    }
  }
  if (status !== undefined) patch.status = String(status) as any;
  if (ivaEnabled !== undefined) patch.ivaEnabled = Boolean(ivaEnabled);
  if (discount !== undefined)
    patch.discount = String(toDiscountPercent(discount));
  if (currency !== undefined) patch.currency = String(currency);
  if (shippingFee !== undefined)
    (patch as any).shippingFee = toNonNegativeNumericString(shippingFee);

  const itemInputs: OrderItemInput[] | undefined = Array.isArray(items)
    ? items
    : undefined;

  const employeeId = await resolveEmployeeId(request);

  const [orderRow] = await db
    .select({ orderCode: orders.orderCode, status: orders.status })
    .from(orders)
    .where(eq(orders.id, String(id)))
    .limit(1);

  if (!orderRow) return new Response("Not found", { status: 404 });

  const updated = await db.transaction(async (tx) => {
    const previousStatus = orderRow.status ?? null;

    if (Object.keys(patch).length > 0) {
      await tx
        .update(orders)
        .set(patch)
        .where(eq(orders.id, String(id)));
    }

    if (
      patch.status !== undefined &&
      patch.status !== null &&
      String(patch.status) !== String(previousStatus ?? "")
    ) {
      await insertOrderStatusHistory(
        tx,
        String(id),
        String(patch.status),
        employeeId,
      );
    }

    if (itemInputs) {
      const existing = await tx
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(eq(orderItems.orderId, String(id)));

      const existingIds = existing.map((r) => r.id);

      if (existingIds.length > 0) {
        await tx
          .delete(orderItemRevisions)
          .where(inArray(orderItemRevisions.orderItemId, existingIds));
        await tx
          .delete(orderItemStatusHistory)
          .where(inArray(orderItemStatusHistory.orderItemId, existingIds));
        await tx
          .delete(orderItemConfection)
          .where(inArray(orderItemConfection.orderItemId, existingIds));
        await tx
          .delete(inventoryOutputs)
          .where(inArray(inventoryOutputs.orderItemId, existingIds));
        await tx.delete(orderItems).where(inArray(orderItems.id, existingIds));
      }

      let subtotal = 0;

      if (itemInputs.length > 0) {
        const normalizedItems = itemInputs.map((it) => {
          const qty = toPositiveInt(it.quantity);

          if (!qty) {
            throw new Error("quantity must be positive");
          }

          const unit = toNullableNumericString(it.unitPrice);
          const unitNumber = unit ? Number(unit) : 0;
          const totalNumber = unitNumber * qty;

          subtotal += totalNumber;

          return {
            orderId: String(id),
            productId: toNullableString(it.productId),
            name: toNullableString(it.name),
            quantity: qty,
            unitPrice: unit,
            totalPrice: String(totalNumber),
            status: "PENDIENTE" as any,
            requiresRevision: false,
          };
        });

        const inserted = await tx
          .insert(orderItems)
          .values(normalizedItems as any)
          .returning({ id: orderItems.id, status: orderItems.status });

        await insertOrderItemStatusHistory(tx, inserted as any, employeeId);
      }
      const currentDiscount =
        discount !== undefined
          ? toDiscountPercent(discount)
          : toDiscountPercent(
              (
                await tx
                  .select({ discount: orders.discount })
                  .from(orders)
                  .where(eq(orders.id, String(id)))
                  .limit(1)
              )[0]?.discount,
            );

      const totalAfterDiscount = subtotal * (1 - currentDiscount / 100);

      await tx
        .update(orders)
        .set({ total: String(totalAfterDiscount) })
        .where(eq(orders.id, String(id)));
    }

    const [res] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, String(id)));

    return res;
  });

  const nextStatus = patch.status !== undefined ? String(patch.status) : null;

  if (nextStatus && nextStatus !== String(orderRow.status ?? "")) {
    await createNotificationsForPermission("VER_PEDIDO", {
      title: "Cambio de estado",
      message: `Pedido ${orderRow.orderCode} pasó a ${nextStatus}.`,
      href: `/orders/${id}/detail`,
    });
  }

  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "orders:delete",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id) {
    return new Response("Order ID required", { status: 400 });
  }

  const deleted = await db.transaction(async (tx) => {
    const items = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.orderId, String(id)));

    const itemIds = items.map((r) => r.id);

    await tx.delete(orderPayments).where(eq(orderPayments.orderId, String(id)));
    await tx
      .delete(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, String(id)));

    if (itemIds.length > 0) {
      await tx
        .delete(orderItemRevisions)
        .where(inArray(orderItemRevisions.orderItemId, itemIds));
      await tx
        .delete(orderItemStatusHistory)
        .where(inArray(orderItemStatusHistory.orderItemId, itemIds));
      await tx
        .delete(orderItemConfection)
        .where(inArray(orderItemConfection.orderItemId, itemIds));
      await tx
        .delete(inventoryOutputs)
        .where(inArray(inventoryOutputs.orderItemId, itemIds));
      await tx.delete(orderItems).where(inArray(orderItems.id, itemIds));
    }

    const delRes = await tx
      .delete(orders)
      .where(eq(orders.id, String(id)))
      .returning();

    const res = Array.isArray(delRes) ? delRes[0] : (delRes as any)?.rows?.[0];

    return res;
  });

  return Response.json(deleted);
}
