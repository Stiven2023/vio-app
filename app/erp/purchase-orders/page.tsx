import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@heroui/button";

import { PurchaseOrdersTab } from "./_components/purchase-orders-tab";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function PurchaseOrdersPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "CREAR_ORDEN_COMPRA",
    "REGISTRAR_ENTRADA",
  ]);

  if (!perms.CREAR_ORDEN_COMPRA) redirect("/unauthorized");

  const canFinalize = perms.REGISTRAR_ENTRADA;

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Purchase orders</h1>
      <p className="text-default-600 mt-1">
        Purchasing operations center: documentation, approval, routes and
        logistics coordination.
      </p>
      <div className="mt-4">
        <Button as={Link} color="primary" href="/erp/purchase-orders/requirements" variant="flat">
          Open purchase requirements
        </Button>
      </div>
      <div className="mt-6">
        <PurchaseOrdersTab canFinalize={canFinalize} />
      </div>
    </div>
  );
}
