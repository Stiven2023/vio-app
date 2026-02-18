import { eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  employees,
  inventoryItems,
  inventoryOutputs,
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
import { rateLimit } from "@/src/utils/rate-limit";
import { canRoleChangeStatus } from "@/src/utils/role-status";

const orderItemStatuses = new Set([
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
  "EN_REVISION_CAMBIO",
  "APROBADO_CAMBIO",
  "RECHAZADO_CAMBIO",
  "COMPLETADO",
  "CANCELADO",
]);

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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-items:get-one",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const orderItemId = String(id ?? "").trim();

  if (!orderItemId) return new Response("id required", { status: 400 });

  const [itemRow] = await db
    .select({
      item: orderItems,
      productName: products.name,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.id, orderItemId))
    .limit(1);

  if (!itemRow?.item) return new Response("Not found", { status: 404 });

  const item = {
    ...itemRow.item,
    productName: itemRow.productName ?? null,
  };

  const packaging = await db
    .select()
    .from(orderItemPackaging)
    .where(eq(orderItemPackaging.orderItemId, orderItemId));

  const socks = await db
    .select()
    .from(orderItemSocks)
    .where(eq(orderItemSocks.orderItemId, orderItemId));

  const materialsRows = await db
    .select({
      orderItemId: orderItemMaterials.orderItemId,
      inventoryItemId: orderItemMaterials.inventoryItemId,
      quantity: orderItemMaterials.quantity,
      note: orderItemMaterials.note,
      itemName: inventoryItems.name,
      unit: inventoryItems.unit,
    })
    .from(orderItemMaterials)
    .leftJoin(
      inventoryItems,
      eq(orderItemMaterials.inventoryItemId, inventoryItems.id),
    )
    .where(eq(orderItemMaterials.orderItemId, orderItemId));

  const deliveredRows = await db
    .select({
      inventoryItemId: inventoryOutputs.inventoryItemId,
      deliveredQty: sql<string>`coalesce(sum(coalesce(${inventoryOutputs.quantity}, 0)::numeric), 0)::text`,
    })
    .from(inventoryOutputs)
    .where(eq(inventoryOutputs.orderItemId, orderItemId))
    .groupBy(inventoryOutputs.inventoryItemId);

  const deliveredByItem = new Map(
    deliveredRows
      .filter((r) => r.inventoryItemId)
      .map((r) => [String(r.inventoryItemId), r.deliveredQty]),
  );

  const materials = materialsRows.map((m) => ({
    ...m,
    deliveredQty: m.inventoryItemId
      ? deliveredByItem.get(String(m.inventoryItemId)) ?? "0"
      : "0",
  }));

  return Response.json({ item, packaging, socks, materials });
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-items:put",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const body = (await request.json()) as any;
  const employeeId = await resolveEmployeeId(request);

  if (body.status !== undefined) {
    const forbiddenStatus = await requirePermission(
      request,
      "CAMBIAR_ESTADO_DISEÑO",
    );

    if (forbiddenStatus) return forbiddenStatus;
  }

  const orderItemId = String(id ?? "").trim();

  if (!orderItemId) return new Response("id required", { status: 400 });

  const [existing] = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      name: orderItems.name,
      status: orderItems.status,
    })
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId))
    .limit(1);

  if (!existing) return new Response("Not found", { status: 404 });

  const advisorForbidden = await assertAdvisorOrderAccess(
    request,
    String(existing.orderId ?? ""),
  );

  if (advisorForbidden) return advisorForbidden;

  const [orderRow] = await db
    .select({
      kind: orders.kind,
      clientPriceType: clients.priceClientType,
    })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .where(eq(orders.id, existing.orderId!))
    .limit(1);

  const kind = orderRow?.kind ?? "NUEVO";

  const patch: Partial<typeof orderItems.$inferInsert> = {};

  const qty = body.quantity !== undefined ? toPositiveInt(body.quantity) : null;

  // COMPLETACION: solo se permite cambiar quantity y empaques
  if (kind === "COMPLETACION") {
    if (body.status !== undefined) {
      return new Response("status change not allowed for completacion", {
        status: 400,
      });
    }

    if (qty) patch.quantity = qty;

    await db.transaction(async (tx) => {
      if (Object.keys(patch).length > 0) {
        await tx
          .update(orderItems)
          .set(patch)
          .where(eq(orderItems.id, orderItemId));
      }

      if (Array.isArray(body.packaging)) {
        await tx
          .delete(orderItemPackaging)
          .where(eq(orderItemPackaging.orderItemId, orderItemId));

        const packaging = body.packaging as any[];

        if (packaging.length > 0) {
          await tx.insert(orderItemPackaging).values(
            packaging.map((p) => ({
              orderItemId,
              mode: String(p.mode ?? "AGRUPADO"),
              size: String(p.size ?? ""),
              quantity:
                p.quantity === undefined ? null : toPositiveInt(p.quantity),
              personName: toNullableString(p.personName),
              personNumber: toNullableString(p.personNumber),
            })) as any,
          );
        }
      }

      await recalcOrderTotal(tx, existing.orderId!);
    });

    const [res] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, orderItemId));

    return Response.json(res);
  }

  if (qty) patch.quantity = qty;
  if (body.productId !== undefined)
    patch.productId = toNullableString(body.productId);
  if (body.productPriceId !== undefined)
    patch.productPriceId = toNullableString(body.productPriceId);
  if (body.name !== undefined) patch.name = toNullableString(body.name);
  if (
    body.unitPrice !== undefined &&
    String(orderRow?.clientPriceType ?? "VIOMAR") === "AUTORIZADO"
  )
    patch.unitPrice = toNullableNumericString(body.unitPrice);
  if (body.totalPrice !== undefined)
    patch.totalPrice = toNullableNumericString(body.totalPrice);
  if (body.observations !== undefined)
    patch.observations = toNullableString(body.observations);
  if (body.fabric !== undefined) patch.fabric = toNullableString(body.fabric);
  if (body.imageUrl !== undefined)
    patch.imageUrl = toNullableString(body.imageUrl);
  if (body.screenPrint !== undefined)
    patch.screenPrint = Boolean(body.screenPrint);
  if (body.embroidery !== undefined)
    patch.embroidery = Boolean(body.embroidery);
  if (body.buttonhole !== undefined)
    patch.buttonhole = Boolean(body.buttonhole);
  if (body.snap !== undefined) patch.snap = Boolean(body.snap);
  if (body.tag !== undefined) patch.tag = Boolean(body.tag);
  if (body.flag !== undefined) patch.flag = Boolean(body.flag);
  if (body.gender !== undefined) patch.gender = toNullableString(body.gender);
  if (body.process !== undefined)
    patch.process = toNullableString(body.process);
  if (body.neckType !== undefined)
    patch.neckType = toNullableString(body.neckType);
  if (body.sleeve !== undefined) patch.sleeve = toNullableString(body.sleeve);
  if (body.color !== undefined) patch.color = toNullableString(body.color);
  if (body.requiresSocks !== undefined)
    patch.requiresSocks = Boolean(body.requiresSocks);
  if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);
  if (body.manufacturingId !== undefined)
    patch.manufacturingId = toNullableString(body.manufacturingId);
  if (body.status !== undefined) {
    const nextStatus = String(body.status ?? "").trim().toUpperCase();

    if (!orderItemStatuses.has(nextStatus)) {
      return new Response("invalid status", { status: 400 });
    }

    const role = getRoleFromRequest(request);
    const currentStatus = String(existing.status ?? "").trim().toUpperCase();

    if (!canRoleChangeStatus(role, currentStatus, nextStatus)) {
      return new Response("Forbidden", { status: 403 });
    }

    patch.status = nextStatus as any;
  }

  const updated = await db.transaction(async (tx) => {
    if (Object.keys(patch).length > 0) {
      await tx
        .update(orderItems)
        .set(patch)
        .where(eq(orderItems.id, orderItemId));
    }

    if (
      patch.status !== undefined &&
      patch.status !== null &&
      String(patch.status) !== String(existing.status ?? "")
    ) {
      await tx.insert(orderItemStatusHistory).values({
        orderItemId,
        status: patch.status as any,
        changedBy: employeeId,
      });
    }

    if (Array.isArray(body.packaging)) {
      await tx
        .delete(orderItemPackaging)
        .where(eq(orderItemPackaging.orderItemId, orderItemId));

      const packaging = body.packaging as any[];

      if (packaging.length > 0) {
        await tx.insert(orderItemPackaging).values(
          packaging.map((p) => ({
            orderItemId,
            mode: String(p.mode ?? "AGRUPADO"),
            size: String(p.size ?? ""),
            quantity:
              p.quantity === undefined ? null : toPositiveInt(p.quantity),
            personName: toNullableString(p.personName),
            personNumber: toNullableString(p.personNumber),
          })) as any,
        );
      }
    }

    if (Array.isArray(body.socks)) {
      await tx
        .delete(orderItemSocks)
        .where(eq(orderItemSocks.orderItemId, orderItemId));

      const socks = body.socks as any[];

      if (socks.length > 0) {
        await tx.insert(orderItemSocks).values(
          socks.map((s) => ({
            orderItemId,
            size: String(s.size ?? ""),
            quantity:
              s.quantity === undefined ? null : toPositiveInt(s.quantity),
            description: toNullableString(s.description),
            imageUrl: toNullableString(s.imageUrl),
          })) as any,
        );
      }
    }

    if (Array.isArray(body.materials)) {
      await tx
        .delete(orderItemMaterials)
        .where(eq(orderItemMaterials.orderItemId, orderItemId));

      const materials = body.materials as any[];
      const inventoryIds = materials
        .map((m) => String(m.inventoryItemId ?? "").trim())
        .filter(Boolean);

      const existingInv = inventoryIds.length
        ? await tx
            .select({ id: inventoryItems.id })
            .from(inventoryItems)
            .where(inArray(inventoryItems.id, inventoryIds))
        : [];

      const existingSet = new Set(existingInv.map((r) => r.id));

      if (materials.length > 0) {
        await tx.insert(orderItemMaterials).values(
          materials
            .map((m) => ({
              orderItemId,
              inventoryItemId: String(m.inventoryItemId ?? "").trim(),
              quantity: toNullableNumericString(m.quantity),
              note: toNullableString(m.note),
            }))
            .filter((m) => existingSet.has(m.inventoryItemId)) as any,
        );
      }
    }

    const [res] = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, orderItemId))
      .limit(1);

    await recalcOrderTotal(tx, existing.orderId!);

    return res;
  });

  const nextStatus = patch.status !== undefined ? String(patch.status) : null;

  if (nextStatus && nextStatus !== String(existing.status ?? "")) {
    await createNotificationsForPermission("VER_DISEÑO", {
      title: "Cambio de estado",
      message: `Diseño ${existing.name ?? existing.id} pasó a ${nextStatus}.`,
      href: `/orders/${existing.orderId}/items/${existing.id}`,
    });
  }

  return Response.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-items:delete",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const orderItemId = String(id ?? "").trim();

  if (!orderItemId) return new Response("id required", { status: 400 });

  const [existing] = await db
    .select({ id: orderItems.id, orderId: orderItems.orderId })
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId))
    .limit(1);

  if (!existing) return new Response("Not found", { status: 404 });

  await db.transaction(async (tx) => {
    await tx
      .delete(orderItemMaterials)
      .where(eq(orderItemMaterials.orderItemId, orderItemId));
    await tx
      .delete(orderItemPackaging)
      .where(eq(orderItemPackaging.orderItemId, orderItemId));
    await tx
      .delete(orderItemSocks)
      .where(eq(orderItemSocks.orderItemId, orderItemId));
    await tx.delete(orderItems).where(eq(orderItems.id, orderItemId));

    await recalcOrderTotal(tx, existing.orderId!);
  });

  return new Response(null, { status: 204 });
}
