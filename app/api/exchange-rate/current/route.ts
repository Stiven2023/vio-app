import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { getLatestUsdCopRate } from "@/src/utils/exchange-rate";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "exchange-rate:current:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  const latest = await getLatestUsdCopRate();

  if (!latest) {
    return new Response("No hay tasa USD/COP registrada", { status: 404 });
  }

  return Response.json(latest);
}
