import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { eq } from "drizzle-orm";

import { OrderItemEditPage } from "./_components/order-item-edit-page";

import { db } from "@/src/db";
import { orders } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function EditOrderItemRoute({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "EDITAR_PEDIDO");

  if (forbidden) redirect("/dashboard");

  const { id, itemId } = await params;
  const orderId = String(id ?? "").trim();
  const orderItemId = String(itemId ?? "").trim();

  if (!orderId || !orderItemId) redirect("/orders");

  const [order] = await db
    .select({
      id: orders.id,
      kind: orders.kind,
      currency: orders.currency,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) redirect(`/orders/${orderId}/items`);

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <OrderItemEditPage
        itemId={orderItemId}
        orderCurrency={(order.currency ?? "COP") as any}
        orderId={orderId}
        orderKind={order.kind ?? "NUEVO"}
      />
    </div>
  );
}
