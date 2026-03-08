import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PurchaseOrdersTab } from "./_components/purchase-orders-tab";

import { requirePermission } from "@/src/utils/permission-middleware";

export default async function PurchaseOrdersPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "CREAR_ORDEN_COMPRA");
  if (forbidden) redirect("/unauthorized");

  const canFinalize = !(await requirePermission(req, "REGISTRAR_ENTRADA"));
  const canAssociateSupplier = !(await requirePermission(req, "ASOCIAR_PROVEEDOR"));

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Órdenes de compra</h1>
      <p className="text-default-600 mt-1">
        Crea órdenes (pendiente) y finalízalas para registrar la entrada a inventario.
      </p>
      <div className="mt-6">
        <PurchaseOrdersTab
          canFinalize={canFinalize}
          canAssociateSupplier={canAssociateSupplier}
        />
      </div>
    </div>
  );
}
