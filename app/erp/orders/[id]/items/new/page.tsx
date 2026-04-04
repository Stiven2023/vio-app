export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { OrderItemCreatePage } from "./_components/order-item-create-page";

import { db } from "@/src/db";
import { employees, orders, roles } from "@/src/db/erp/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import {
  filterDesignerOptions,
  type DesignerOption,
} from "@/app/erp/orders/_lib/designer-options";

const MONTAJE_LOCKED_STATUSES = new Set([
  "PRODUCCION",
  "ATRASADO",
  "FINALIZADO",
  "ENTREGADO",
  "CANCELADO",
]);

export default async function NewOrderItemRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "EDITAR_PEDIDO");

  if (forbidden) redirect("/unauthorized");

  const { id } = await params;
  const orderId = String(id ?? "").trim();

  if (!orderId) redirect("/orders");

  const [order] = await db
    .select({
      id: orders.id,
      kind: orders.kind,
      status: orders.status,
      currency: orders.currency,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) redirect(`/orders/${orderId}/items`);

  // Bloquear creación desde PRODUCCION (montaje) en adelante
  if (MONTAJE_LOCKED_STATUSES.has(String(order.status ?? ""))) {
    redirect(`/orders/${orderId}/items`);
  }

  // Solo se crean diseños en pedidos NUEVO
  if ((order.kind ?? "NUEVO") !== "NUEVO") {
    redirect(`/orders/${orderId}/items`);
  }

  const designerRows = await db
    .select({
      id: employees.id,
      name: employees.name,
      role: roles.name,
      roleName: roles.name,
      isActive: employees.isActive,
    })
    .from(employees)
    .leftJoin(roles, eq(employees.roleId, roles.id))
    .orderBy(asc(employees.name));

  const designerOptions: DesignerOption[] = filterDesignerOptions(designerRows);

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <OrderItemCreatePage
        designerOptions={designerOptions}
        orderCurrency={(order.currency ?? "COP") as any}
        orderId={orderId}
        orderKind={order.kind ?? "NUEVO"}
      />
    </div>
  );
}
