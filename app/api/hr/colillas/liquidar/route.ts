import { ZodError } from "zod";

import {
  dbJsonError,
  jsonError,
  jsonForbidden,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { hcmLiquidarColillaSchema } from "@/src/utils/hcm-contract";
import { liquidarColilla } from "@/src/hcm/services/hcm.service";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "hcm:colillas:liquidar:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PROVISIONES_NOMINA");

  if (forbidden) return jsonForbidden();

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo no es JSON valido.", {
      body: ["Envia un JSON valido."],
    });
  }

  const parsed = hcmLiquidarColillaSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "La solicitud de colilla es invalida.",
    );
  }

  try {
    const result = await liquidarColilla(parsed.data);

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return zodFirstErrorEnvelope(
        error,
        "La solicitud de colilla es invalida.",
      );
    }

    const dbError = dbJsonError(error, "No se pudo liquidar la colilla.");

    if (dbError) return dbError;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo liquidar la colilla.");
  }
}
