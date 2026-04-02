import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { moldingTemplateInsumos, moldingTemplates } from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type CreateInsumoBody = {
  inventoryItemId?: unknown;
  variantId?: unknown;
  qtyPerUnit?: unknown;
  unit?: unknown;
  variesBySize?: unknown;
  additionId?: unknown;
  notes?: unknown;
};

function parseStr(v: unknown, maxLen = 255): string | null {
  const s = String(v ?? "").trim();

  return s.length > 0 ? s.slice(0, maxLen) : null;
}

function parseBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

function parseDecimal(v: unknown): string | null {
  const n = Number(v);

  return Number.isFinite(n) && n > 0 ? String(n) : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "molding-template-insumos:get",
    limit: 150,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MOLDERIA");

  if (forbidden) return forbidden;

  const { id } = await params;

  try {
    const template = await db
      .select({ id: moldingTemplates.id })
      .from(moldingTemplates)
      .where(eq(moldingTemplates.id, id))
      .limit(1);

    if (template.length === 0) {
      return new Response("Molding template not found", { status: 404 });
    }

    const insumos = await db
      .select()
      .from(moldingTemplateInsumos)
      .where(eq(moldingTemplateInsumos.moldingTemplateId, id));

    return Response.json({ items: insumos });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("Could not retrieve insumos", { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "molding-template-insumos:post",
    limit: 50,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_MOLDERIA");

  if (forbidden) return forbidden;

  const { id } = await params;

  let body: CreateInsumoBody;

  try {
    body = (await request.json()) as CreateInsumoBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const inventoryItemId = parseStr(body.inventoryItemId, 36);
  const qtyPerUnit = parseDecimal(body.qtyPerUnit);
  const unit = parseStr(body.unit, 50);

  if (!inventoryItemId || !qtyPerUnit || !unit) {
    return new Response("inventoryItemId, qtyPerUnit and unit are required", {
      status: 400,
    });
  }

  try {
    const template = await db
      .select({ id: moldingTemplates.id })
      .from(moldingTemplates)
      .where(eq(moldingTemplates.id, id))
      .limit(1);

    if (template.length === 0) {
      return new Response("Molding template not found", { status: 404 });
    }

    const [created] = await db
      .insert(moldingTemplateInsumos)
      .values({
        moldingTemplateId: id,
        inventoryItemId,
        variantId: parseStr(body.variantId, 36),
        qtyPerUnit,
        unit,
        variesBySize: parseBool(body.variesBySize),
        additionId: parseStr(body.additionId, 36),
        notes: parseStr(body.notes, 2000),
      })
      .returning();

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("Could not create insumo", { status: 500 });
  }
}
