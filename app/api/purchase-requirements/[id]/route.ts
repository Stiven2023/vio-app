import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  purchaseRequirementLines,
  purchaseRequirements,
} from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type UpdateRequirementBody = {
  status?: unknown;
  lines?: Array<{
    id?: unknown;
    category?: unknown;
    description?: unknown;
    qtyPlanned?: unknown;
    unit?: unknown;
    qtyOrdered?: unknown;
    qtyReceived?: unknown;
    coverageStatus?: unknown;
    inventoryItemId?: unknown;
  }>;
};

function str(value: unknown) {
  return String(value ?? "").trim();
}

function numericOrNull(value: unknown) {
  if (value === undefined) return null;
  const parsed = Number(String(value ?? "").replace(/,/g, "."));

  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return parsed.toFixed(2);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "purchase-requirements:get-one",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const requirementId = str(id);

    if (!requirementId) return new Response("id required", { status: 400 });

    const [requirement] = await db
      .select()
      .from(purchaseRequirements)
      .where(eq(purchaseRequirements.id, requirementId))
      .limit(1);

    if (!requirement) return new Response("Not found", { status: 404 });

    const lines = await db
      .select()
      .from(purchaseRequirementLines)
      .where(eq(purchaseRequirementLines.purchaseRequirementId, requirementId));

    return Response.json({ ...requirement, lines });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo consultar requerimiento", { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "purchase-requirements:put",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const requirementId = str(id);

    if (!requirementId) return new Response("id required", { status: 400 });

    const body = (await request.json().catch(() => ({}))) as UpdateRequirementBody;
    const employeeId = getEmployeeIdFromRequest(request);

    const status = str(body.status).toUpperCase();
    const lines = Array.isArray(body.lines) ? body.lines : [];

    const allowedStatus = new Set([
      "BORRADOR",
      "EN_REVISION",
      "APROBADO",
      "CERRADO",
    ]);

    if (status && !allowedStatus.has(status)) {
      return new Response("status invalid", { status: 400 });
    }

    const updated = await db.transaction(async (tx) => {
      const [requirement] = await tx
        .select({
          id: purchaseRequirements.id,
          status: purchaseRequirements.status,
        })
        .from(purchaseRequirements)
        .where(eq(purchaseRequirements.id, requirementId))
        .limit(1);

      if (!requirement) return { kind: "not-found" as const };

      if (status) {
        await tx
          .update(purchaseRequirements)
          .set({
            status,
            approvedBy: status === "APROBADO" ? employeeId : null,
            approvedAt: status === "APROBADO" ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(purchaseRequirements.id, requirementId));
      }

      if (lines.length > 0) {
        const ids = lines.map((line) => str(line.id)).filter(Boolean);

        if (ids.length > 0) {
          const existing = await tx
            .select({ id: purchaseRequirementLines.id })
            .from(purchaseRequirementLines)
            .where(
              and(
                eq(purchaseRequirementLines.purchaseRequirementId, requirementId),
                inArray(purchaseRequirementLines.id, ids),
              ),
            );

          const existingSet = new Set(existing.map((row) => row.id));

          for (const line of lines) {
            const lineId = str(line.id);

            if (!lineId || !existingSet.has(lineId)) continue;

            const category = str(line.category);
            const description = str(line.description);
            const qtyPlanned = numericOrNull(line.qtyPlanned);
            const unit = str(line.unit);
            const qtyOrdered = numericOrNull(line.qtyOrdered);
            const qtyReceived = numericOrNull(line.qtyReceived);
            const coverageStatus = str(line.coverageStatus).toUpperCase();
            const inventoryItemId = str(line.inventoryItemId) || null;

            const patch: Record<string, unknown> = {
              updatedAt: new Date(),
            };

            if (category) patch.category = category;
            if (description) patch.description = description;
            if (qtyPlanned !== null) patch.qtyPlanned = qtyPlanned;
            if (line.unit !== undefined) patch.unit = unit || null;
            if (qtyOrdered !== null) patch.qtyOrdered = qtyOrdered;
            if (qtyReceived !== null) patch.qtyReceived = qtyReceived;
            if (coverageStatus) patch.coverageStatus = coverageStatus;
            if (line.inventoryItemId !== undefined) {
              patch.inventoryItemId = inventoryItemId;
            }

            await tx
              .update(purchaseRequirementLines)
              .set(patch as any)
              .where(eq(purchaseRequirementLines.id, lineId));
          }
        }
      }

      const [fresh] = await tx
        .select()
        .from(purchaseRequirements)
        .where(eq(purchaseRequirements.id, requirementId))
        .limit(1);

      const freshLines = await tx
        .select()
        .from(purchaseRequirementLines)
        .where(eq(purchaseRequirementLines.purchaseRequirementId, requirementId));

      return { kind: "ok" as const, requirement: fresh, lines: freshLines };
    });

    if (updated.kind === "not-found") {
      return new Response("Not found", { status: 404 });
    }

    return Response.json({ ...updated.requirement, lines: updated.lines });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo actualizar requerimiento", { status: 500 });
  }
}
