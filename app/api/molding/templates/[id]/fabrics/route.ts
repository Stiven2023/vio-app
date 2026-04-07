import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { moldingTemplates } from "@/src/db/erp/schema";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { listTemplateCompatibleFabrics } from "@/src/utils/molding-fabric-compat";
import { moldingTemplateFabricParamsSchema } from "@/src/utils/molding-fabrics-contract";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "molding-template-fabrics:get",
    limit: 150,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MOLDERIA");

  if (forbidden) return forbidden;

  const resolvedParams = await params;
  const parsed = moldingTemplateFabricParamsSchema.safeParse(resolvedParams);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Parámetros de moldería inválidos.");
  }

  const { id } = parsed.data;

  try {
    const [template] = await db
      .select({ id: moldingTemplates.id })
      .from(moldingTemplates)
      .where(eq(moldingTemplates.id, id))
      .limit(1);

    if (!template) {
      return jsonError(404, "MOLDING_TEMPLATE_NOT_FOUND", "Moldería no encontrada.");
    }

    const items = await listTemplateCompatibleFabrics({
      dbOrTx: db,
      moldingTemplateId: id,
    });

    return Response.json({ items });
  } catch (error) {
    const dbError = dbErrorResponse(error);

    if (dbError) {
      return jsonError(
        dbError.status,
        "DATABASE_ERROR",
        "No se pudieron consultar las telas de la moldería.",
      );
    }

    return jsonError(
      500,
      "MOLDING_TEMPLATE_FABRICS_FETCH_FAILED",
      "No se pudieron consultar las telas de la moldería.",
    );
  }
}
