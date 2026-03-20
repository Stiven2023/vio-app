import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { factoringRecords } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type NextStatus = "COLLECTED" | "VOIDED";

const ALLOWED_STATUS = new Set<NextStatus>(["COLLECTED", "VOIDED"]);

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "factoring:status:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_FACTORING");

  if (forbidden) return forbidden;

  try {
    const { id } = await context.params;
    const factoringId = String(id ?? "").trim();
    const body = await request.json();
    const status = String(body?.status ?? "")
      .trim()
      .toUpperCase() as NextStatus;

    if (!factoringId) return new Response("id required", { status: 400 });
    if (!ALLOWED_STATUS.has(status)) {
      return new Response("status invalid", { status: 400 });
    }

    const [updated] = await db
      .update(factoringRecords)
      .set({ status })
      .where(
        and(
          eq(factoringRecords.id, factoringId),
          eq(factoringRecords.status, "ACTIVE"),
        ),
      )
      .returning({
        id: factoringRecords.id,
        status: factoringRecords.status,
      });

    if (!updated) {
      const [existing] = await db
        .select({ id: factoringRecords.id, status: factoringRecords.status })
        .from(factoringRecords)
        .where(eq(factoringRecords.id, factoringId))
        .limit(1);

      if (!existing?.id) {
        return new Response("Registro de factoring no encontrado", {
          status: 404,
        });
      }

      return new Response("Solo se pueden actualizar registros ACTIVE", {
        status: 409,
      });
    }

    return Response.json({ ok: true, id: updated.id, status: updated.status });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo actualizar el estado de factoring", {
      status: 500,
    });
  }
}
