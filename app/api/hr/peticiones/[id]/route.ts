import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { employeeRequests } from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { resolvePetitionSchema } from "@/src/schemas/hcm";
import { zodFirstErrorResponse } from "@/src/utils/zod-response";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "hr-peticiones:patch",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "APROBAR_PERMISO_EMPLEADO");

  if (forbidden) return forbidden;

  const { id } = await params;

  try {
    const body = await request.json();

    const parsed = resolvePetitionSchema.safeParse(body);

    if (!parsed.success) return zodFirstErrorResponse(parsed.error);

    const { status: rawStatus, responseNotes: parsedNotes } = parsed.data;

    const [existing] = await db
      .select({ id: employeeRequests.id, status: employeeRequests.status })
      .from(employeeRequests)
      .where(eq(employeeRequests.id, id))
      .limit(1);

    if (!existing) {
      return new Response("Petición no encontrada", { status: 404 });
    }

    const responseNotes = parsedNotes !== undefined ? (parsedNotes || null) : undefined;
    const resolvedBy = getEmployeeIdFromRequest(request);
    const isResolved = rawStatus === "APROBADO" || rawStatus === "RECHAZADO" || rawStatus === "CERRADO";

    const patch: {
      status: typeof rawStatus;
      responseNotes?: string | null;
      resolvedBy?: string | null;
      resolvedAt?: Date | null;
      updatedAt: Date;
    } = {
      status: rawStatus,
      updatedAt: new Date(),
    };

    if (responseNotes !== undefined) {
      patch.responseNotes = responseNotes;
    }

    if (isResolved) {
      patch.resolvedBy = resolvedBy;
      patch.resolvedAt = new Date();
    }

    await db
      .update(employeeRequests)
      .set(patch)
      .where(eq(employeeRequests.id, id));

    return Response.json({ ok: true });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo actualizar la petición", { status: 500 });
  }
}
