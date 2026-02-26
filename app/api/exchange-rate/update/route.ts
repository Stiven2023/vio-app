import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { updateUsdCopRateDaily } from "@/src/utils/exchange-rate";

function isCronAuthorized(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;

  if (!configuredSecret) return false;

  const received =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  return received === configuredSecret;
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "exchange-rate:update:post",
    limit: 40,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const cronAuthorized = isCronAuthorized(request);

  if (!cronAuthorized) {
    const forbidden = await requirePermission(request, "EDITAR_ITEM_INVENTARIO");

    if (forbidden) return forbidden;
  }

  const body = await request.json().catch(() => ({}));
  const floorRate = Number(body?.floorRate ?? 3600);

  if (!Number.isFinite(floorRate) || floorRate <= 0) {
    return new Response("floorRate inválido", { status: 400 });
  }

  const updated = await updateUsdCopRateDaily({ floorRate });

  return Response.json({
    message: "Tasa USD/COP actualizada",
    rate: updated,
    macroConversion: updated.macroConversion ?? null,
    note:
      updated.adjustmentApplied > 0
        ? `Se ajustó +${updated.adjustmentApplied.toFixed(4)} para respetar el piso de ${updated.floorRate.toFixed(4)}.`
        : "No fue necesario ajuste por piso.",
    conversionNote: updated.macroConversion
      ? `Conversión masiva aplicada: ${updated.macroConversion.productsUpdated} productos y ${updated.macroConversion.additionsUpdated} adiciones.`
      : "Conversión masiva no aplicada.",
  });
}
