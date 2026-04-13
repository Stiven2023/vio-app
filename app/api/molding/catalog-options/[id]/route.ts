import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { moldingCatalogOptions } from "@/src/db/schema";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

const patchOptionSchema = z.object({
  label: z.string().trim().max(120).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const limited = rateLimit(request, {
    key: "molding-catalog-options:patch",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_MOLDERIA");

  if (forbidden) return forbidden;

  const { id } = await params;

  try {
    const existing = await db
      .select()
      .from(moldingCatalogOptions)
      .where(eq(moldingCatalogOptions.id, id))
      .limit(1);

    if (!existing.length) {
      return jsonError(404, "NOT_FOUND", "Opción no encontrada.");
    }

    const body = await request.json();
    const parsed = patchOptionSchema.safeParse(body);

    if (!parsed.success) {
      return zodFirstErrorEnvelope(parsed.error, "Datos inválidos.");
    }

    const updates: Partial<(typeof existing)[0]> = {};

    if (parsed.data.isActive !== undefined)
      updates.isActive = parsed.data.isActive;
    if (parsed.data.sortOrder !== undefined)
      updates.sortOrder = parsed.data.sortOrder;
    if ("label" in parsed.data) updates.label = parsed.data.label ?? null;

    if (Object.keys(updates).length === 0) {
      return Response.json({ option: existing[0] });
    }

    const [updated] = await db
      .update(moldingCatalogOptions)
      .set(updates)
      .where(eq(moldingCatalogOptions.id, id))
      .returning();

    return Response.json({ option: updated });
  } catch (err) {
    const errResponse = dbErrorResponse(err);

    if (errResponse) return errResponse;

    return new Response("Error al actualizar opción de catálogo", {
      status: 500,
    });
  }
}
