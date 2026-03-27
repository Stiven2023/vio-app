import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { getDesignFullView } from "@/src/utils/design-overview";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderItemId: string }> },
) {
  const limited = rateLimit(request, {
    key: "mes-designs:get-one",
    limit: 150,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MES");

  if (forbidden) return forbidden;

  const { orderItemId } = await params;
  const fullView = await getDesignFullView(orderItemId);

  if (!fullView) {
    return new Response("Design not found", { status: 404 });
  }

  return Response.json(fullView);
}