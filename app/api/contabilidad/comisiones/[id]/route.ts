import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { advisorCommissionRates } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function toRate(value: unknown) {
  const n = Number(value ?? 0);

  if (!Number.isFinite(n) || n < 0 || n > 1) return null;

  return String(n);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "contabilidad:comisiones:patch",
    limit: 100,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const recordId = String(id ?? "").trim();

    if (!recordId) return new Response("id is required", { status: 400 });

    const body = (await request.json()) as {
      advisorName?: unknown;
      rate?: unknown;
      isActive?: unknown;
    };

    const patch: Partial<typeof advisorCommissionRates.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.advisorName !== undefined) {
      const name = String(body.advisorName ?? "").trim();

      if (!name) {
        return new Response("advisorName cannot be empty", { status: 400 });
      }
      patch.advisorName = name;
    }

    if (body.rate !== undefined) {
      const rate = toRate(body.rate);

      if (rate === null) {
        return new Response("rate must be a valid decimal between 0 and 1", {
          status: 400,
        });
      }
      patch.rate = rate;
    }

    if (body.isActive !== undefined) {
      patch.isActive = Boolean(body.isActive);
    }

    const [updated] = await db
      .update(advisorCommissionRates)
      .set(patch)
      .where(eq(advisorCommissionRates.id, recordId))
      .returning();

    if (!updated) {
      return new Response("Registro no encontrado", { status: 404 });
    }

    return Response.json(updated);
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo actualizar la comisión", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "contabilidad:comisiones:delete",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const recordId = String(id ?? "").trim();

    if (!recordId) return new Response("id is required", { status: 400 });

    const [updated] = await db
      .update(advisorCommissionRates)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(advisorCommissionRates.id, recordId))
      .returning({ id: advisorCommissionRates.id });

    if (!updated) {
      return new Response("Registro no encontrado", { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo desactivar la comisión", { status: 500 });
  }
}
