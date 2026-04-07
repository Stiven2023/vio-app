import { z } from "zod";

import { aplicarSurchargePrioritario } from "@/src/erp/services/priority-surcharge.service";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

const bodySchema = z.object({
  surchargeConfigId: z.string().uuid(),
  razon: z.string().trim().min(3).max(500),
  empleadoId: z.string().uuid().optional(),
});

function mapSurchargeError(error: unknown) {
  const message = String((error as Error)?.message ?? "");

  if (message === "ORDER_NOT_FOUND") {
    return jsonError(404, "ORDER_NOT_FOUND", "La orden indicada no existe.");
  }

  if (message === "SURCHARGE_ALREADY_APPLIED") {
    return jsonError(
      409,
      "SURCHARGE_ALREADY_APPLIED",
      "La orden ya tiene un cargo prioritario aplicado.",
    );
  }

  if (message === "SURCHARGE_CONFIG_NOT_FOUND") {
    return jsonError(
      404,
      "SURCHARGE_CONFIG_NOT_FOUND",
      "No existe una configuración activa para el cargo prioritario.",
      {
        surchargeConfigId: ["Selecciona una configuración de cargo válida."],
      },
    );
  }

  return null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "orders:surcharge:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await context.params;
  const orderId = String(id ?? "").trim();

  if (!orderId) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "El id de la orden es obligatorio.",
      {
        id: ["Debes indicar la orden a priorizar."],
      },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(
      400,
      "INVALID_JSON",
      "El cuerpo de la solicitud debe ser JSON válido.",
    );
  }

  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Datos inválidos para aplicar surcharge.",
    );
  }

  const empleadoId =
    parsed.data.empleadoId ?? getEmployeeIdFromRequest(request) ?? "";

  if (!empleadoId) {
    return jsonError(
      401,
      "UNAUTHENTICATED",
      "No se pudo identificar el empleado autenticado.",
    );
  }

  try {
    const data = await aplicarSurchargePrioritario({
      orderId,
      surchargeConfigId: parsed.data.surchargeConfigId,
      empleadoQuePriorizaId: empleadoId,
      razon: parsed.data.razon,
    });

    return Response.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    const mapped = mapSurchargeError(error);

    if (mapped) return mapped;

    const dbError = dbJsonError(
      error,
      "No se pudo aplicar el cargo prioritario.",
    );

    if (dbError) return dbError;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo aplicar el cargo prioritario.",
    );
  }
}
