import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { moldingTemplateInsumos } from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type UpdateInsumoBody = {
  inventoryItemId?: unknown;
  variantId?: unknown;
  qtyPerUnit?: unknown;
  unit?: unknown;
  variesBySize?: unknown;
  additionId?: unknown;
  notes?: unknown;
};

function parseStr(v: unknown, maxLen = 255): string | null | undefined {
  if (v === undefined) return undefined;

  const s = String(v ?? "").trim();

  return s.length > 0 ? s.slice(0, maxLen) : null;
}

function parseBool(v: unknown): boolean | undefined {
  if (v === undefined) return undefined;

  return v === true || v === "true" || v === 1;
}

function parseDecimal(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;

  const n = Number(v);

  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; insumoId: string }> },
) {
  const limited = rateLimit(request, {
    key: "molding-template-insumo-id:patch",
    limit: 50,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_MOLDERIA");

  if (forbidden) return forbidden;

  const { id, insumoId } = await params;

  let body: UpdateInsumoBody;

  try {
    body = (await request.json()) as UpdateInsumoBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  try {
    const existing = await db
      .select({ id: moldingTemplateInsumos.id })
      .from(moldingTemplateInsumos)
      .where(
        and(
          eq(moldingTemplateInsumos.id, insumoId),
          eq(moldingTemplateInsumos.moldingTemplateId, id),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      return new Response("Insumo not found", { status: 404 });
    }

    const updates: Partial<typeof moldingTemplateInsumos.$inferInsert> = {};

    const inventoryItemId = parseStr(body.inventoryItemId, 36);

    if (body.inventoryItemId !== undefined && !inventoryItemId) {
      return new Response("inventoryItemId cannot be empty", { status: 400 });
    }
    if (typeof inventoryItemId === "string") {
      updates.inventoryItemId = inventoryItemId;
    }

    const variantId = parseStr(body.variantId, 36);

    if (variantId !== undefined) updates.variantId = variantId;

    const qtyPerUnit = parseDecimal(body.qtyPerUnit);

    if (body.qtyPerUnit !== undefined && !qtyPerUnit) {
      return new Response("qtyPerUnit must be a positive number", {
        status: 400,
      });
    }
    if (typeof qtyPerUnit === "string") {
      updates.qtyPerUnit = qtyPerUnit;
    }

    const unit = parseStr(body.unit, 50);

    if (body.unit !== undefined && !unit) {
      return new Response("unit cannot be empty", { status: 400 });
    }
    if (typeof unit === "string") {
      updates.unit = unit;
    }

    const variesBySize = parseBool(body.variesBySize);

    if (variesBySize !== undefined) updates.variesBySize = variesBySize;

    const additionId = parseStr(body.additionId, 36);

    if (additionId !== undefined) updates.additionId = additionId;

    const notes = parseStr(body.notes, 2000);

    if (notes !== undefined) updates.notes = notes;

    const [updated] = await db
      .update(moldingTemplateInsumos)
      .set(updates)
      .where(
        and(
          eq(moldingTemplateInsumos.id, insumoId),
          eq(moldingTemplateInsumos.moldingTemplateId, id),
        ),
      )
      .returning();

    return Response.json(updated);
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("Could not update insumo", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; insumoId: string }> },
) {
  const limited = rateLimit(request, {
    key: "molding-template-insumo-id:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_MOLDERIA");

  if (forbidden) return forbidden;

  const { id, insumoId } = await params;

  try {
    const [deleted] = await db
      .delete(moldingTemplateInsumos)
      .where(
        and(
          eq(moldingTemplateInsumos.id, insumoId),
          eq(moldingTemplateInsumos.moldingTemplateId, id),
        ),
      )
      .returning({ id: moldingTemplateInsumos.id });

    if (!deleted) {
      return new Response("Insumo not found", { status: 404 });
    }

    return Response.json({ ok: true, id: deleted.id });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("Could not delete insumo", { status: 500 });
  }
}
