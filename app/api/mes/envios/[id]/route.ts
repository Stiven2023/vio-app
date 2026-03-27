/**
 * PATCH /api/mes/envios/[id]  — update status (EN_RUTA, ENTREGADO, RETORNADO, INCIDENTE)
 */
import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { mesEnvios } from "@/src/db/schema";
import { mesEnvioStatusValues } from "@/src/db/enums";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, { key: "mes:envios:patch", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_MES");
  if (forbidden) return forbidden;

  const { id } = await params;
  const envioId = String(id ?? "").trim();
  if (!envioId) return new Response("id required", { status: 400 });

  const body = await request.json();
  const status = String(body?.status ?? "").toUpperCase();
  if (!(mesEnvioStatusValues as readonly string[]).includes(status))
    return new Response("status inválido", { status: 400 });

  const update: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (status === "EN_RUTA" && !body?.salidaAt) update.salidaAt = new Date();
  if (body?.salidaAt) update.salidaAt = new Date(body.salidaAt);
  if (body?.llegadaAt) update.llegadaAt = new Date(body.llegadaAt);
  if (body?.retornoAt) update.retornoAt = new Date(body.retornoAt);
  if (status === "ENTREGADO" && !body?.llegadaAt) update.llegadaAt = new Date();
  if (status === "RETORNADO" && !body?.retornoAt) update.retornoAt = new Date();
  if (body?.observaciones != null)
    update.observaciones = String(body.observaciones).trim() || null;
  if (body?.evidenciaUrl != null)
    update.evidenciaUrl = String(body.evidenciaUrl).trim() || null;

  await db.update(mesEnvios).set(update as any).where(eq(mesEnvios.id, envioId));

  return new Response(null, { status: 204 });
}
