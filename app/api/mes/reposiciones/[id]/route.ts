/**
 * GET    /api/mes/reposiciones/[id]
 * PATCH  /api/mes/reposiciones/[id]
 */
import { eq } from "drizzle-orm";

import { mesDb } from "@/src/db";
import { mesReposiciones } from "@/src/db/mes/schema";
import {
  dbJsonError,
  jsonForbidden,
  jsonNotFound,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { mesReposicionUpdateSchema, toValidDate } from "@/src/utils/mes-workflow";

function toStr(v: unknown) {
  return String(v ?? "").trim() || null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "mes:reposicion:get",
    limit: 300,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MES");
  if (forbidden) return jsonForbidden();

  const { id } = await params;

  const [row] = await mesDb
    .select()
    .from(mesReposiciones)
    .where(eq(mesReposiciones.id, id))
    .limit(1);

  if (!row) return jsonNotFound("Reposición no encontrada.");

  return Response.json({ ok: true, data: row });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "mes:reposicion:patch",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "GESTIONAR_MES");
  if (forbidden) return jsonForbidden();

  const { id } = await params;

  const [existing] = await mesDb
    .select({ id: mesReposiciones.id, status: mesReposiciones.status })
    .from(mesReposiciones)
    .where(eq(mesReposiciones.id, id))
    .limit(1);

  if (!existing) return jsonNotFound("Reposición no encontrada.");

  const body = await request.json().catch(() => null);
  const parsed = mesReposicionUpdateSchema.safeParse(body);
  if (!parsed.success) return zodFirstErrorEnvelope(parsed.error);

  const data = parsed.data;
  const closedBy = getEmployeeIdFromRequest(request);

  const isClosed = data.status === "CERRADA";
  const closedAt = isClosed ? (toValidDate(data.closedAt) ?? new Date()) : undefined;

  const updateResult = await mesDb
    .update(mesReposiciones)
    .set({
      ...(data.status ? { status: data.status as any } : {}),
      ...(data.notes !== undefined ? { notes: toStr(data.notes) } : {}),
      ...(isClosed ? { closedBy: closedBy ?? undefined, closedAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(mesReposiciones.id, id))
    .returning()
    .catch((e) => dbJsonError(e, "No se pudo actualizar la reposición."));

  if (updateResult instanceof Response) return updateResult;
  const updated = updateResult?.[0];

  return Response.json({ ok: true, data: updated });
}
