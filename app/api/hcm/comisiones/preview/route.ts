import { z } from "zod";

import { calcularComisionPeriodo } from "@/src/hcm/services/commissions.service";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

const querySchema = z.object({
  employeeId: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "hcm:comisiones:preview:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_COMISIONES_HCM");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      employeeId: String(searchParams.get("employeeId") ?? "").trim(),
      period: String(searchParams.get("period") ?? "").trim(),
    });

    if (!parsed.success) {
      return zodFirstErrorEnvelope(
        parsed.error,
        "Parámetros inválidos para calcular comisión.",
      );
    }

    const data = await calcularComisionPeriodo(
      parsed.data.employeeId,
      parsed.data.period,
    );

    return Response.json({ ok: true, data });
  } catch (error) {
    const dbError = dbJsonError(
      error,
      "No se pudo calcular la comisión del período.",
    );

    if (dbError) return dbError;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo calcular la comisión del período.",
    );
  }
}
