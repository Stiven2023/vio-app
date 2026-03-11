import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountingTabs } from "@/app/erp/contabilidad/_components/contabilidad-tabs";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function AccountingPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_PEDIDO");
  if (forbidden) redirect("/unauthorized");

  const canEdit = !(await requirePermission(req, "EDITAR_PEDIDO"));
  const canApprovePayments = !(await requirePermission(req, "APROBAR_PAGO"));

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Accounting</h1>
      <p className="text-default-600 mt-1">Pre-invoices and consolidated deposits.</p>
      <div className="mt-6">
        <AccountingTabs canApprovePayments={canApprovePayments} canEdit={canEdit} />
      </div>
    </div>
  );
}
