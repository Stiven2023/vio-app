import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PurchaseOrderPageForm } from "../../_components/purchase-order-page-form";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function PurchaseOrderEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = (await cookies()).get("auth_token")?.value;
  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, ["CREAR_ORDEN_COMPRA", "ASOCIAR_PROVEEDOR"]);

  if (!perms.CREAR_ORDEN_COMPRA) redirect("/unauthorized");

  const canAssociateSupplier = perms.ASOCIAR_PROVEEDOR;
  const { id } = await params;

  return (
    <div className="container mx-auto max-w-7xl px-6 pb-10 pt-16">
      <PurchaseOrderPageForm canAssociateSupplier={canAssociateSupplier} orderId={id} />
    </div>
  );
}
