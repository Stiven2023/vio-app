import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PurchaseOrderPageForm } from "../../_components/purchase-order-page-form";

import { requirePermission } from "@/src/utils/permission-middleware";

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

  const forbidden = await requirePermission(req, "CREAR_ORDEN_COMPRA");
  if (forbidden) redirect("/unauthorized");

  const canAssociateSupplier = !(await requirePermission(req, "ASOCIAR_PROVEEDOR"));
  const { id } = await params;

  return (
    <div className="container mx-auto max-w-7xl px-6 pb-10 pt-16">
      <PurchaseOrderPageForm canAssociateSupplier={canAssociateSupplier} orderId={id} />
    </div>
  );
}
