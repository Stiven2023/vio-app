import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountingTabs } from "@/app/erp/contabilidad/_components/contabilidad-tabs";
import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function DepositsPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_PEDIDO",
    "EDITAR_PEDIDO",
    "APROBAR_PAGO",
  ]);

  if (!perms.VER_PEDIDO) redirect("/unauthorized");

  const canEdit = perms.EDITAR_PEDIDO;
  const canApprovePayments = perms.APROBAR_PAGO;

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Depósitos - Efectivo y Transferencias</h1>
      <p className="text-default-600 mt-1">Registro unificado de depósitos en efectivo y consignaciones bancarias, con seguimiento de estado y aprobación de pagos.</p>
      <div className="mt-6">
        <AccountingTabs
          canApprovePayments={canApprovePayments}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
