import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { calculateLegalDiscounts } from "@/src/utils/legal-discounts";
import { legalDiscountsPreviewBodySchema } from "@/src/utils/legal-discounts-contract";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "contabilidad:descuentos-legales:preview:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_RETENCIONES");

  if (forbidden) return forbidden;

  const body = await request.json().catch(() => ({}));
  const parsed = legalDiscountsPreviewBodySchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Datos invalidos para calcular descuentos legales.",
    );
  }

  try {
    const data = calculateLegalDiscounts(parsed.data);

    return Response.json({ ok: true, data });
  } catch {
    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo calcular descuentos legales.",
    );
  }
}
