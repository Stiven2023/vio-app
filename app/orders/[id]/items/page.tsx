import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { OrderItemsPage } from "./_components/order-items-page";

import { requirePermission } from "@/src/utils/permission-middleware";

export default async function OrderItemsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_PEDIDO");

  if (forbidden) redirect("/unauthorized");

  const canEdit = !(await requirePermission(req, "EDITAR_PEDIDO"));
  const canAssign = !(await requirePermission(req, "ASIGNAR_CONFECCIONISTA"));
  const canChangeStatus = !(await requirePermission(
    req,
    "CAMBIAR_ESTADO_DISEÑO",
  ));

  const { id } = await params;

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <OrderItemsPage
        canAssign={canAssign}
        canChangeStatus={canChangeStatus}
        canEdit={canEdit}
        orderId={id}
      />
    </div>
  );
}
