import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { OrdersTab } from "@/app/erp/orders/_components/orders-tab";
import { checkPermissions } from "@/src/utils/permission-middleware";
import { verifyAuthToken } from "@/src/utils/auth";

export default async function OrdersPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const payload = verifyAuthToken(token);
  const role =
    payload && typeof payload === "object"
      ? (payload as { role?: unknown }).role
      : null;
  const employeeId =
    payload && typeof payload === "object"
      ? (payload as { employeeId?: unknown }).employeeId
      : null;
  const isAdvisor = role === "ASESOR";
  const canCommercialDecision =
    role === "ADMINISTRADOR" || role === "LIDER_COMERCIAL";

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_PEDIDO",
    "CREAR_PEDIDO",
    "EDITAR_PEDIDO",
    "ELIMINAR_PEDIDO",
    "CAMBIAR_ESTADO_PEDIDO",
    "VER_HISTORIAL_ESTADO",
  ]);

  if (!perms.VER_PEDIDO) redirect("/unauthorized");

  const canCreate = perms.CREAR_PEDIDO;
  const canEdit = perms.EDITAR_PEDIDO;
  const canDelete = perms.ELIMINAR_PEDIDO;
  const canChangeStatus = perms.CAMBIAR_ESTADO_PEDIDO;
  const canSeeHistory = perms.VER_HISTORIAL_ESTADO;

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Orders</h1>
      <p className="text-default-600 mt-1">View and manage orders.</p>
      <div className="mt-6">
        <OrdersTab
          advisorEmployeeId={typeof employeeId === "string" ? employeeId : null}
          canChangeStatus={canChangeStatus}
          canCommercialDecision={canCommercialDecision}
          canCreate={canCreate}
          canDelete={canDelete}
          canEdit={canEdit}
          canSeeHistory={canSeeHistory}
          isAdvisor={isAdvisor}
        />
      </div>
    </div>
  );
}
