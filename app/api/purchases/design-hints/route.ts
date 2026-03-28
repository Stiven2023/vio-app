import { getDesignFullView, listPurchaseHints } from "@/src/utils/design-overview";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "purchases:design-hints:get",
    limit: 80,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const orderItemId = String(searchParams.get("orderItemId") ?? "").trim();
  const limitRaw = Number(searchParams.get("limit") ?? 40);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(100, Math.floor(limitRaw)))
    : 40;

  if (orderItemId) {
    const fullView = await getDesignFullView(orderItemId);

    if (!fullView) {
      return new Response("Order item not found", { status: 404 });
    }

    return Response.json({ items: [fullView.purchaseHints] });
  }

  const items = await listPurchaseHints(limit);

  return Response.json({ items });
}
