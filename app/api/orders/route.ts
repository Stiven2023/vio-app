import { and, desc, eq, ilike, inArray, like, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  employees,
  orderItemConfection,
  orderItemMaterials,
  orderItemPackaging,
  orderItemRevisions,
  orderItemSocks,
  orderItemStatusHistory,
  orderItems,
  orders,
  stockMovements,
  orderPayments,
  orderStatusHistory,
  prefacturas,
  quotations,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getUserIdFromRequest,
  getRoleFromRequest,
} from "@/src/utils/auth-middleware";
import { isConfirmedPaymentStatus } from "@/src/utils/payment-status";
import {
  calculateOrderPaymentPercent,
  canTransitionOrderStatus,
  requiresApprovalBeforeProgramming,
} from "@/src/utils/order-workflow";
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

async function resolveAdvisorFilter(request: Request) {
  const role = getRoleFromRequest(request);

  if (role !== "ASESOR") return null;

  const employeeId = await resolveEmployeeId(request);

  if (!employeeId) return "forbidden";

  return employeeId;
}

async function assertAdvisorOwnsOrder(request: Request, orderId: string) {
  const advisorScope = await resolveAdvisorFilter(request);

  if (advisorScope === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }

  if (!advisorScope) return null;

  const [row] = await db
    .select({ createdBy: orders.createdBy })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) return new Response("Not found", { status: 404 });

  if (row.createdBy !== advisorScope) {
    return new Response("Forbidden", { status: 403 });
  }

  return null;
}

type OrderTypeCode = "VN" | "VI" | "VT" | "VW";

async function generateOrderCode(tx: any, type: OrderTypeCode): Promise<string> {
  const prefix = `${type}-`;
  const seqLen = type === "VI" ? 4 : 6;

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

async function generateDraftOrderCode(tx: any): Promise<string> {
  const pattern = "^TMP-([0-9]+)$";

  const [row] = await tx
    .select({
      maxSeq: sql<number>`max((substring(${orders.orderCode} from ${pattern})::int))`,
    })
    .from(orders)
    .where(like(orders.orderCode, "TMP-%"))
    .limit(1);

  const maxSeq = Number(row?.maxSeq ?? 0);
  const nextSeq = Number.isFinite(maxSeq) ? maxSeq + 1 : 1;

  return `TMP-${String(nextSeq).padStart(6, "0")}`;
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

  const advisorScope = await resolveAdvisorFilter(request);

  if (advisorScope === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const q = String(searchParams.get("q") ?? "").trim();
  const status = String(searchParams.get("status") ?? "").trim();
  const type = String(searchParams.get("type") ?? "").trim().toUpperCase();

  const filters: Array<any> = [
    q
      ? sql`(
          ${orders.orderCode} ilike ${`%${q}%`}
          or ${clients.clientCode} ilike ${`%${q}%`}
          or ${clients.name} ilike ${`%${q}%`}
        )`
      : undefined,
    status && status !== "all" ? eq(orders.status, status as any) : undefined,
    type === "VN" || type === "VI" || type === "VT" || type === "VW"
      ? eq(orders.type, type as any)
      : undefined,
    advisorScope ? eq(orders.createdBy, advisorScope) : undefined,
  ].filter(Boolean);

  const where = filters.length ? and(...filters) : undefined;

  const totalQuery = db
    .select({ total: sql<number>`count(distinct ${orders.id})::int` })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id));

  const [{ total }] = where ? await totalQuery.where(where) : await totalQuery;

  const itemsQuery = db
    .select({
      id: orders.id,
      orderCode: sql<string>`coalesce(case when ${(orders as any).operationalApprovedAt} is null then ${(orders as any).provisionalCode} end, ${orders.orderCode})`,
      kind: (orders as any).kind,
      sourceOrderId: (orders as any).sourceOrderId,
      sourceOrderCode: sql<
        string | null
      >`(select o2.order_code from orders o2 where o2.id = ${(orders as any).sourceOrderId})`,
      createdBy: orders.createdBy,
      clientId: orders.clientId,
      clientName: clients.name,
      clientCode: clients.clientCode,
      type: orders.type,
      status: orders.status,
      total: orders.total,
      ivaEnabled: orders.ivaEnabled,
      discount: orders.discount,
      currency: orders.currency,
      shippingFee: (orders as any).shippingFee,
      paidTotal: sql<string>`coalesce((select sum(op.amount) from order_payments op where op.order_id = ${orders.id} and op.status in ('PAGADO', 'CONFIRMADO_CAJA')), 0)::text`,
      provisionalCode: (orders as any).provisionalCode,
      operationalApprovedAt: (orders as any).operationalApprovedAt,
      lastStatusAt: sql<string | null>`(
        select osh.created_at
        from order_status_history osh
        where osh.order_id = ${orders.id}
        order by osh.created_at desc
        limit 1
      )`,
      lastStatusBy: sql<string | null>`(
        select e.name
        from order_status_history osh
        left join employees e on e.id = osh.changed_by
        where osh.order_id = ${orders.id}
        order by osh.created_at desc
        limit 1
      )`,
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
    provisionalCode,
  } = await request.json();

  const normalizedType = String(type ?? "VN")
    .trim()
    .toUpperCase();
  const orderType =
    normalizedType === "VI" || normalizedType === "VT" || normalizedType === "VW"
      ? (normalizedType as OrderTypeCode)
      : ("VN" as OrderTypeCode);

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
    const normalizedProvisionalCode = provisionalCode
      ? String(provisionalCode).trim().slice(0, 60)
      : "";

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await generateDraftOrderCode(tx);

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
            provisionalCode: normalizedProvisionalCode || null,
          } as any)
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
    provisionalCode,
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

  const hasNonStatusChanges =
    clientId !== undefined ||
    type !== undefined ||
    kind !== undefined ||
    sourceOrderCode !== undefined ||
    ivaEnabled !== undefined ||
    discount !== undefined ||
    currency !== undefined ||
    shippingFee !== undefined ||
    items !== undefined;

  const isStatusOnlyUpdate = status !== undefined && !hasNonStatusChanges;

  if (isStatusOnlyUpdate) {
    const forbiddenStatusOnly = await requirePermission(
      request,
      "CAMBIAR_ESTADO_PEDIDO",
    );

    if (forbiddenStatusOnly) return forbiddenStatusOnly;
  } else {
    const forbiddenEdit = await requirePermission(request, "EDITAR_PEDIDO");

    if (forbiddenEdit) return forbiddenEdit;

    if (status !== undefined) {
      const forbiddenStatus = await requirePermission(
        request,
        "CAMBIAR_ESTADO_PEDIDO",
      );

      if (forbiddenStatus) return forbiddenStatus;
    }
  }

  const advisorForbidden = await assertAdvisorOwnsOrder(request, String(id));

  if (advisorForbidden) return advisorForbidden;

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
  if (provisionalCode !== undefined)
    (patch as any).provisionalCode = provisionalCode
      ? String(provisionalCode).trim().slice(0, 60) || null
      : null;

  const itemInputs: OrderItemInput[] | undefined = Array.isArray(items)
    ? items
    : undefined;

  const employeeId = await resolveEmployeeId(request);

  const [orderRow] = await db
    .select({
      orderCode: orders.orderCode,
      status: orders.status,
      total: orders.total,
      shippingFee: (orders as any).shippingFee,
    })
    .from(orders)
    .where(eq(orders.id, String(id)))
    .limit(1);

  if (!orderRow) return new Response("Not found", { status: 404 });

  const ORDER_MONTAJE_LOCKED_STATUSES = new Set<string>([
    "PRODUCCION",
    "ATRASADO",
    "FINALIZADO",
    "ENTREGADO",
  ]);

  if (
    ORDER_MONTAJE_LOCKED_STATUSES.has(String(orderRow.status ?? "")) &&
    hasNonStatusChanges
  ) {
    return new Response(
      "No se puede modificar el pedido: ya está en montaje o superior. Solo está permitido consultar y registrar abonos.",
      { status: 422 },
    );
  }

  if (
    patch.status !== undefined &&
    patch.status !== null &&
    !canTransitionOrderStatus(orderRow.status, String(patch.status))
  ) {
    return new Response(
      `Transición inválida: ${String(orderRow.status ?? "-")} -> ${String(patch.status)}`,
      { status: 422 },
    );
  }

  if (String(patch.status ?? "") === "PROGRAMACION") {
    const paidRows = await db
      .select({ amount: orderPayments.amount, status: orderPayments.status })
      .from(orderPayments)
      .where(eq(orderPayments.orderId, String(id)));

    const confirmedPaidTotal = paidRows.reduce((acc, row) => {
      if (!isConfirmedPaymentStatus(row.status)) return acc;
      const amount = Number(row.amount ?? 0);

      return acc + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    const paymentPercent = calculateOrderPaymentPercent({
      total: orderRow.total,
      shippingFee: orderRow.shippingFee,
      paidTotal: confirmedPaidTotal,
    });

    if (requiresApprovalBeforeProgramming(paymentPercent)) {
      return new Response(
        "El pedido no puede pasar a PROGRAMACION con un anticipo confirmado menor al 50%. Envíalo a APROBACION.",
        { status: 422 },
      );
    }
  }

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
          .delete(stockMovements)
          .where(
            and(
              eq(stockMovements.referenceType, "ORDER_ITEM"),
              inArray(stockMovements.referenceId, existingIds),
            ),
          );
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

  const advisorForbidden = await assertAdvisorOwnsOrder(request, String(id));

  if (advisorForbidden) return advisorForbidden;

  const employeeId = await resolveEmployeeId(request);

  const disabled = await db.transaction(async (tx) => {
    const [orderRow] = await tx
      .select({
        id: orders.id,
        orderCode: orders.orderCode,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.id, String(id)))
      .limit(1);

    if (!orderRow) {
      return null;
    }

    const items = await tx
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.orderId, String(id)));

    const itemIds = items.map((r) => r.id);

    await tx
      .update(orderPayments)
      .set({ status: "ANULADO" as any })
      .where(eq(orderPayments.orderId, String(id)));

    await tx
      .update(orderItems)
      .set({
        isActive: false,
        status: "CANCELADO" as any,
      })
      .where(eq(orderItems.orderId, String(id)));

    if (itemIds.length > 0) {
      await tx.insert(orderItemStatusHistory).values(
        itemIds.map((orderItemId) => ({
          orderItemId,
          status: "CANCELADO" as any,
          changedBy: employeeId,
        })),
      );
    }

    const prefRows = await tx
      .select({
        id: prefacturas.id,
        quotationId: prefacturas.quotationId,
      })
      .from(prefacturas)
      .where(eq(prefacturas.orderId, String(id)));

    await tx
      .update(prefacturas)
      .set({ status: "CANCELADA" })
      .where(eq(prefacturas.orderId, String(id)));

    const quotationIds = prefRows
      .map((p) => String(p.quotationId ?? "").trim())
      .filter(Boolean);

    if (quotationIds.length > 0) {
      await tx
        .update(quotations)
        .set({
          prefacturaApproved: false,
          isActive: false,
          updatedAt: new Date(),
        })
        .where(inArray(quotations.id, quotationIds));
    }

    await tx
      .update(orders)
      .set({ status: "CANCELADO" as any })
      .where(eq(orders.id, String(id)));

    await tx.insert(orderStatusHistory).values({
      orderId: String(id),
      status: "CANCELADO" as any,
      changedBy: employeeId,
    });

    const [updated] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, String(id)))
      .limit(1);

    return updated;
  });

  if (!disabled) {
    return new Response("Not found", { status: 404 });
  }

  await createNotificationsForPermission("VER_PEDIDO", {
    title: "Pedido deshabilitado",
    message: `Pedido ${disabled.orderCode} marcado como CANCELADO.`,
    href: `/orders/${String(id)}/detail`,
  });

  return Response.json(disabled);
}
