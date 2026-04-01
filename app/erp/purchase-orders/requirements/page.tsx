export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PurchaseRequirementsTab } from "@/app/erp/purchase-orders/requirements/_components/purchase-requirements-tab";
import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function PurchaseRequirementsPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, ["CREAR_ORDEN_COMPRA"]);

  if (!perms.CREAR_ORDEN_COMPRA) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Purchase requirements</h1>
      <p className="mt-1 text-default-600">
        Review design hints, adjust planning quantities and approve requirement lines.
      </p>
      <div className="mt-6">
        <PurchaseRequirementsTab />
      </div>
    </div>
  );
}
