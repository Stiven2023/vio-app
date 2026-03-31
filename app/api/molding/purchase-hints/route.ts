import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { getDesignFullView, listPurchaseHints } from "@/src/utils/design-overview";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "molding-purchase-hints:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MOLDERIA");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const orderItemId = String(searchParams.get("orderItemId") ?? "").trim();
  const limit = Number(searchParams.get("limit") ?? 40);

  try {
    if (orderItemId) {
      const fullView = await getDesignFullView(orderItemId);

      if (!fullView) {
        return new Response("Order item not found", { status: 404 });
      }

      return Response.json({ items: [fullView.purchaseHints] });
    }

    const items = await listPurchaseHints(
      Number.isFinite(limit)
        ? Math.max(1, Math.min(100, Math.floor(limit)))
        : 40,
    );

    return Response.json({ items });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("Could not retrieve purchase hints", { status: 500 });
  }
}