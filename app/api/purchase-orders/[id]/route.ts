import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  banks,
  employees,
  inventoryItems,
  purchaseOrderHistory,
  purchaseOrderItems,
  purchaseOrders,
  stockMovements,
  suppliers,
} from "@/src/db/schema";
import { getEmployeeIdFromRequest, getRoleFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { resolveWarehouseIdByLocation, syncInventoryForItem } from "@/src/utils/inventory-sync";
import { createNotificationsForPermission } from "@/src/utils/notifications";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

const COST_APPROVER_ROLES = new Set([
  "ADMINISTRADOR",
  "LIDER_FINANCIERA",
  "AUXILIAR_CONTABLE",
  "TESORERIA_Y_CARTERA",
]);

function isExpired(value: Date | string | null | undefined) {
  if (!value) return false;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

async function addHistory(tx: any, args: {
  orderId: string;
  action: string;
  notes?: string | null;
  employeeId?: string | null;
}) {
  await tx.insert(purchaseOrderHistory).values({
    purchaseOrderId: args.orderId,
    action: args.action,
    notes: args.notes ?? null,
    performedBy: args.employeeId ?? null,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "purchase-orders:get-one",
    limit: 300,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");
  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const orderId = String(id ?? "").trim();
    if (!orderId) return new Response("id required", { status: 400 });

    const [order] = await db
      .select({
        id: purchaseOrders.id,
        purchaseOrderCode: purchaseOrders.purchaseOrderCode,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.name,
        supplierCode: suppliers.supplierCode,
        supplierContactName: suppliers.contactName,
        supplierEmail: suppliers.email,
        supplierIdentification: suppliers.identification,
        supplierMobile: suppliers.fullMobile,
        supplierAddress: suppliers.address,
        supplierCity: suppliers.city,
        supplierDepartment: suppliers.department,
        createdBy: purchaseOrders.createdBy,
        createdByName: employees.name,
        status: purchaseOrders.status,
        notes: purchaseOrders.notes,
        bankId: purchaseOrders.bankId,
        bankName: purchaseOrders.bankName,
        bankAccountRef: purchaseOrders.bankAccountRef,
        approvedAt: purchaseOrders.approvedAt,
        approvedBy: purchaseOrders.approvedBy,
        approvedByName: sql<string | null>`(
          select e.name from employees e where e.id = ${purchaseOrders.approvedBy}
        )`,
        approvalExpiresAt: purchaseOrders.approvalExpiresAt,
        rejectedAt: purchaseOrders.rejectedAt,
        rejectedBy: purchaseOrders.rejectedBy,
        rejectedByName: sql<string | null>`(
          select e.name from employees e where e.id = ${purchaseOrders.rejectedBy}
        )`,
        rejectionReason: purchaseOrders.rejectionReason,
        subtotal: purchaseOrders.subtotal,
        total: purchaseOrders.total,
        createdAt: purchaseOrders.createdAt,
        finalizedAt: purchaseOrders.finalizedAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(employees, eq(purchaseOrders.createdBy, employees.id))
      .leftJoin(banks, eq(purchaseOrders.bankId, banks.id))
      .where(eq(purchaseOrders.id, orderId))
      .limit(1);

    if (!order) return new Response("Not found", { status: 404 });

    const items = await db
      .select({
        id: purchaseOrderItems.id,
        inventoryItemId: purchaseOrderItems.inventoryItemId,
        variantId: purchaseOrderItems.variantId,
        itemCode: purchaseOrderItems.itemCode,
        itemName: purchaseOrderItems.itemName,
        unit: purchaseOrderItems.unit,
        quantity: purchaseOrderItems.quantity,
        unitPrice: purchaseOrderItems.unitPrice,
        lineTotal: purchaseOrderItems.lineTotal,
      })
      .from(purchaseOrderItems)
      .leftJoin(
        inventoryItems,
        eq(purchaseOrderItems.inventoryItemId, inventoryItems.id),
      )
      .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

    return Response.json({ ...order, items });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar la orden", { status: 500 });
  }
}

type UpdateBody = { action?: string; reason?: string };

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "purchase-orders:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");
  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const orderId = String(id ?? "").trim();
    if (!orderId) return new Response("id required", { status: 400 });

    const body = (await request.json()) as UpdateBody;
    const action = String(body?.action ?? "").trim().toUpperCase();
    const reason = String(body?.reason ?? "").trim();
    const employeeId = getEmployeeIdFromRequest(request);
    const role = String(getRoleFromRequest(request) ?? "");

    if (!["APROBAR_COSTOS", "RECHAZAR_COSTOS", "INICIAR_RUTA", "FINALIZAR"].includes(action)) {
      return new Response("action inválida", { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      const [order] = await tx
        .select({
          id: purchaseOrders.id,
          purchaseOrderCode: purchaseOrders.purchaseOrderCode,
          status: purchaseOrders.status,
          approvalExpiresAt: purchaseOrders.approvalExpiresAt,
        })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, orderId))
        .limit(1);

      if (!order) return { kind: "not-found" as const };

      if (action === "APROBAR_COSTOS") {
        if (!COST_APPROVER_ROLES.has(role)) {
          return { kind: "forbidden-costs" as const };
        }

        if (order.status === "FINALIZADA") {
          return { kind: "already" as const };
        }

        const approvedAt = new Date();
        const approvalExpiresAt = new Date(approvedAt.getTime() + 5 * 24 * 60 * 60 * 1000);

        const [updated] = await tx
          .update(purchaseOrders)
          .set({
            status: "APROBADA",
            approvedAt,
            approvedBy: employeeId,
            approvalExpiresAt,
            rejectedAt: null,
            rejectedBy: null,
            rejectionReason: null,
          })
          .where(eq(purchaseOrders.id, orderId))
          .returning({
            id: purchaseOrders.id,
            status: purchaseOrders.status,
            approvedAt: purchaseOrders.approvedAt,
            approvalExpiresAt: purchaseOrders.approvalExpiresAt,
          });

        await addHistory(tx, {
          orderId,
          action: "COSTOS_APROBADA",
          notes: "Aprobada por costos con vigencia de 5 días",
          employeeId,
        });

        return { kind: "ok" as const, updated, purchaseOrderCode: order.purchaseOrderCode, action: "APROBAR_COSTOS" as const };
      }

      if (action === "RECHAZAR_COSTOS") {
        if (!COST_APPROVER_ROLES.has(role)) {
          return { kind: "forbidden-costs" as const };
        }

        if (!reason) {
          return { kind: "reason-required" as const };
        }

        const [updated] = await tx
          .update(purchaseOrders)
          .set({
            status: "RECHAZADA",
            rejectedAt: new Date(),
            rejectedBy: employeeId,
            rejectionReason: reason,
            approvedAt: null,
            approvedBy: null,
            approvalExpiresAt: null,
          })
          .where(eq(purchaseOrders.id, orderId))
          .returning({
            id: purchaseOrders.id,
            status: purchaseOrders.status,
            rejectedAt: purchaseOrders.rejectedAt,
            rejectionReason: purchaseOrders.rejectionReason,
          });

        await addHistory(tx, {
          orderId,
          action: "COSTOS_RECHAZADA",
          notes: reason,
          employeeId,
        });

        return { kind: "ok" as const, updated, purchaseOrderCode: order.purchaseOrderCode, action: "RECHAZAR_COSTOS" as const };
      }

      if (isExpired(order.approvalExpiresAt)) {
        const [expiredOrder] = await tx
          .update(purchaseOrders)
          .set({ status: "VENCIDA" })
          .where(eq(purchaseOrders.id, orderId))
          .returning({ id: purchaseOrders.id, status: purchaseOrders.status });

        await addHistory(tx, {
          orderId,
          action: "VIGENCIA_VENCIDA",
          notes: "Orden vencida por superar vigencia de 5 días",
          employeeId,
        });

        return { kind: "expired" as const, updated: expiredOrder };
      }

      if (action === "INICIAR_RUTA") {
        if (order.status !== "APROBADA") {
          return { kind: "invalid-status" as const, status: order.status };
        }

        const [updated] = await tx
          .update(purchaseOrders)
          .set({ status: "EN_PROCESO" })
          .where(eq(purchaseOrders.id, orderId))
          .returning({ id: purchaseOrders.id, status: purchaseOrders.status });

        await addHistory(tx, {
          orderId,
          action: "RUTA_INICIADA",
          notes: "Coordinación logística iniciada",
          employeeId,
        });

        return { kind: "ok" as const, updated, purchaseOrderCode: order.purchaseOrderCode, action: "INICIAR_RUTA" as const };
      }

      const forbiddenEntry = await requirePermission(request, "REGISTRAR_ENTRADA");
      if (forbiddenEntry) {
        return { kind: "forbidden-entry" as const };
      }

      if (order.status === "FINALIZADA") {
        return { kind: "already" as const };
      }

      if (order.status !== "APROBADA" && order.status !== "EN_PROCESO") {
        return { kind: "invalid-status" as const, status: order.status };
      }

      const items = await tx
        .select({
          inventoryItemId: purchaseOrderItems.inventoryItemId,
          quantity: purchaseOrderItems.quantity,
          unitPrice: purchaseOrderItems.unitPrice,
        })
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderId, orderId));

      if (items.length === 0) {
        return { kind: "no-items" as const };
      }

      const warehouseId = await resolveWarehouseIdByLocation(tx, "BODEGA_PRINCIPAL");

      if (!warehouseId) {
        return { kind: "warehouse-not-found" as const };
      }

      await tx.insert(stockMovements).values(
        items.map((it) => ({
          movementType: "ENTRADA" as const,
          reason: "COMPRA_PROVEEDOR" as const,
          inventoryItemId: it.inventoryItemId,
          fromWarehouseId: null,
          toWarehouseId: warehouseId,
          quantity: it.quantity,
          unitCost: it.unitPrice,
          referenceType: "PURCHASE_ORDER" as const,
          referenceId: orderId,
        })),
      );

      const uniqueItemIds = Array.from(
        new Set(items.map((it) => it.inventoryItemId).filter(Boolean)),
      );

      for (const itemId of uniqueItemIds) {
        await syncInventoryForItem(tx, itemId);
      }

      const [updated] = await tx
        .update(purchaseOrders)
        .set({ status: "FINALIZADA", finalizedAt: new Date() })
        .where(eq(purchaseOrders.id, orderId))
        .returning({
          id: purchaseOrders.id,
          status: purchaseOrders.status,
          finalizedAt: purchaseOrders.finalizedAt,
        });

      await addHistory(tx, {
        orderId,
        action: "ORDEN_FINALIZADA",
        notes: "Se registró entrada de inventario por compra aprobada",
        employeeId,
      });

      return { kind: "ok" as const, updated, purchaseOrderCode: order.purchaseOrderCode, action: "FINALIZAR" as const };
    });

    if (result.kind === "not-found") return new Response("Not found", { status: 404 });
    if (result.kind === "forbidden-costs") return new Response("Solo costos puede aprobar/rechazar", { status: 403 });
    if (result.kind === "forbidden-entry") return new Response("No tienes permiso para registrar entrada", { status: 403 });
    if (result.kind === "already") return new Response("Ya finalizada", { status: 409 });
    if (result.kind === "expired") return new Response("La orden está vencida (vigencia 5 días)", { status: 409 });
    if (result.kind === "reason-required") return new Response("reason requerido", { status: 400 });
    if (result.kind === "no-items") return new Response("Sin items", { status: 409 });
    if (result.kind === "warehouse-not-found") return new Response("Bodega no encontrada", { status: 409 });
    if (result.kind === "invalid-status") return new Response("Estado inválido", { status: 409 });

    const poCode = result.purchaseOrderCode ?? orderId;
    const poHref = `/erp/compras/${orderId}`;

    if (result.action === "APROBAR_COSTOS") {
      void createNotificationsForPermission("CREAR_ORDEN_COMPRA", {
        title: "Orden de compra aprobada",
        message: `La orden ${poCode} fue aprobada. Vigencia: 5 días.`,
        href: poHref,
      });
    } else if (result.action === "RECHAZAR_COSTOS") {
      void createNotificationsForPermission("CREAR_ORDEN_COMPRA", {
        title: "Orden de compra rechazada",
        message: `La orden ${poCode} fue rechazada.`,
        href: poHref,
      });
    } else if (result.action === "INICIAR_RUTA") {
      void createNotificationsForPermission("CREAR_ORDEN_COMPRA", {
        title: "Ruta de compra iniciada",
        message: `La orden ${poCode} inició coordinación logística.`,
        href: poHref,
      });
    } else if (result.action === "FINALIZAR") {
      void createNotificationsForPermission("CREAR_ORDEN_COMPRA", {
        title: "Orden de compra finalizada",
        message: `La orden ${poCode} fue finalizada. Inventario actualizado.`,
        href: poHref,
      });
    }

    return Response.json(result.updated);
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo finalizar la orden", { status: 500 });
  }
}
