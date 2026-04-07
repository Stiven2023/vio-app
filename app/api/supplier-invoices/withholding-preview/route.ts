import { z } from "zod";

import { calcularRetencionesSuplier } from "@/src/erp/services/supplier-withholding.service";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

const querySchema = z.object({
  supplierId: z.string().uuid(),
  subtotal: z.coerce.number().nonnegative(),
  serviceType: z.string().trim().min(1).max(80),
});

function mapDomainError(error: unknown) {
  const message = String((error as Error)?.message ?? "");

  if (message === "SUPPLIER_NOT_FOUND") {
    return jsonError(
      404,
      "SUPPLIER_NOT_FOUND",
      "El proveedor indicado no existe.",
    );
  }

  return null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "supplier-invoices:withholding-preview:get",
    limit: 100,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_RETENCIONES");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    supplierId: String(searchParams.get("supplierId") ?? "").trim(),
    subtotal: searchParams.get("subtotal") ?? "0",
    serviceType: String(searchParams.get("serviceType") ?? "COMPRA_INSUMOS")
      .trim()
      .toUpperCase(),
  });

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Parámetros inválidos para retenciones de proveedor.",
    );
  }

  try {
    const data = await calcularRetencionesSuplier(
      parsed.data.supplierId,
      parsed.data.subtotal,
      parsed.data.serviceType,
    );

    return Response.json({ ok: true, data });
  } catch (error) {
    const mapped = mapDomainError(error);

    if (mapped) return mapped;

    const dbError = dbJsonError(
      error,
      "No se pudo calcular la retención del proveedor.",
    );

    if (dbError) return dbError;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo calcular la retención del proveedor.",
    );
  }
}
