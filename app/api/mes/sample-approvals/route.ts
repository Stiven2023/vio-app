/**
 * GET    /api/mes/sample-approvals?orderId=<uuid>
 * PUT    /api/mes/sample-approvals        — upsert por orderId
 */
import { eq } from "drizzle-orm";

import { mesDb } from "@/src/db";
import { mesSampleApprovals } from "@/src/db/mes/schema";
import {
  dbJsonError,
  jsonError,
  jsonForbidden,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { mesSampleApprovalUpsertSchema, toValidDate } from "@/src/utils/mes-workflow";

function toStr(v: unknown) {
  return String(v ?? "").trim() || null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:sample-approvals:get",
    limit: 300,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MES");
  if (forbidden) return jsonForbidden();

  const { searchParams } = new URL(request.url);
  const orderId = String(searchParams.get("orderId") ?? "").trim();

  if (!orderId) {
    return jsonError(400, "VALIDATION_ERROR", "El pedido es obligatorio.", {
      orderId: ["Debes indicar el pedido a consultar."],
    });
  }

  const [row] = await mesDb
    .select()
    .from(mesSampleApprovals)
    .where(eq(mesSampleApprovals.orderId, orderId))
    .limit(1);

  return Response.json({ ok: true, data: row ?? null });
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:sample-approvals:put",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const forbidden = await requirePermission(request, "GESTIONAR_MES");
  if (forbidden) return jsonForbidden();

  const body = await request.json().catch(() => null);
  const parsed = mesSampleApprovalUpsertSchema.safeParse(body);
  if (!parsed.success) return zodFirstErrorEnvelope(parsed.error);

  const data = parsed.data;

  const sampleApprovedAt =
    data.sampleApprovalStatus === "APROBADO"
      ? (toValidDate(data.sampleApprovedAt) ?? new Date())
      : null;

  const upsertResult = await mesDb
    .insert(mesSampleApprovals)
    .values({
      orderId: data.orderId,
      assemblyPin: toStr(data.assemblyPin),
      sampleApprovalStatus: (data.sampleApprovalStatus ?? "PENDIENTE") as any,
      sampleApprovedAt: sampleApprovedAt ?? undefined,
      sampleApprovedBy: toStr(data.sampleApprovedBy),
      notes: toStr(data.notes),
    })
    .onConflictDoUpdate({
      target: mesSampleApprovals.orderId,
      set: {
        assemblyPin: toStr(data.assemblyPin),
        sampleApprovalStatus: (data.sampleApprovalStatus ?? "PENDIENTE") as any,
        sampleApprovedAt: sampleApprovedAt ?? undefined,
        sampleApprovedBy: toStr(data.sampleApprovedBy),
        notes: toStr(data.notes),
        updatedAt: new Date(),
      },
    })
    .returning()
    .catch((e) => dbJsonError(e, "No se pudo guardar la aprobación de muestra."));

  if (upsertResult instanceof Response) return upsertResult;
  const upserted = upsertResult?.[0];

  return Response.json({ ok: true, data: upserted }, { status: 200 });
}
