import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  employees,
  purchaseOrderHistory,
  purchaseOrderRoutes,
} from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type CreateRouteBody = {
  routeType?: string;
  partyType?: string;
  partyId?: string | null;
  partyLabel?: string | null;
  driverLabel?: string | null;
  vehiclePlate?: string | null;
  originArea?: string;
  destinationArea?: string;
  scheduledAt?: string | null;
  notes?: string | null;
};

function str(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "purchase-orders:routes:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const orderId = str(id);

    if (!orderId) return new Response("id required", { status: 400 });

    const items = await db
      .select({
        id: purchaseOrderRoutes.id,
        routeType: purchaseOrderRoutes.routeType,
        partyType: purchaseOrderRoutes.partyType,
        partyId: purchaseOrderRoutes.partyId,
        partyLabel: purchaseOrderRoutes.partyLabel,
        driverLabel: purchaseOrderRoutes.driverLabel,
        vehiclePlate: purchaseOrderRoutes.vehiclePlate,
        originArea: purchaseOrderRoutes.originArea,
        destinationArea: purchaseOrderRoutes.destinationArea,
        scheduledAt: purchaseOrderRoutes.scheduledAt,
        status: purchaseOrderRoutes.status,
        notes: purchaseOrderRoutes.notes,
        createdBy: purchaseOrderRoutes.createdBy,
        createdByName: employees.name,
        createdAt: purchaseOrderRoutes.createdAt,
      })
      .from(purchaseOrderRoutes)
      .leftJoin(employees, eq(purchaseOrderRoutes.createdBy, employees.id))
      .where(eq(purchaseOrderRoutes.purchaseOrderId, orderId))
      .orderBy(desc(purchaseOrderRoutes.createdAt));

    return Response.json({ items });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar rutas logísticas", {
      status: 500,
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "purchase-orders:routes:post",
    limit: 100,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const orderId = str(id);

    if (!orderId) return new Response("id required", { status: 400 });

    const body = (await request.json()) as CreateRouteBody;

    const routeType = str(body.routeType).toUpperCase();
    const partyType = str(body.partyType).toUpperCase();
    const partyId = str(body.partyId) || null;
    const partyLabel = str(body.partyLabel) || null;
    const driverLabel = str(body.driverLabel) || null;
    const vehiclePlate = str(body.vehiclePlate).toUpperCase() || null;
    const originArea = str(body.originArea).toUpperCase();
    const destinationArea = str(body.destinationArea).toUpperCase();
    const notes = str(body.notes) || null;
    const scheduledAtRaw = str(body.scheduledAt);
    const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;
    const employeeId = getEmployeeIdFromRequest(request);

    if (!routeType || !partyType || !originArea || !destinationArea) {
      return new Response(
        "routeType, partyType, originArea y destinationArea son requeridos",
        {
          status: 400,
        },
      );
    }

    const [created] = await db.transaction(async (tx) => {
      const [newRoute] = await tx
        .insert(purchaseOrderRoutes)
        .values({
          purchaseOrderId: orderId,
          routeType: routeType as any,
          partyType: partyType as any,
          partyId,
          partyLabel,
          driverLabel,
          vehiclePlate,
          originArea,
          destinationArea,
          scheduledAt,
          notes,
          createdBy: employeeId,
        })
        .returning();

      await tx.insert(purchaseOrderHistory).values({
        purchaseOrderId: orderId,
        action: "RUTA_CREADA",
        notes: `${routeType} ${originArea} -> ${destinationArea}`,
        performedBy: employeeId,
      });

      return [newRoute];
    });

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo crear la ruta logística", { status: 500 });
  }
}
