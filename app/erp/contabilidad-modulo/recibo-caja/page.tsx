import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ReciboCajaTab } from "./_components/recibo-caja-tab";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function ReciboCajaPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, ["VER_PEDIDO", "APROBAR_PAGO"]);

  if (!perms.VER_PEDIDO) redirect("/unauthorized");

  const canApprovePayments = perms.APROBAR_PAGO;

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Recibo de caja</h1>
      <p className="mt-1 text-default-600">
        Pagos en efectivo recibidos. Confirma los recibos en caja o rechaza
        pagos incorrectos.
      </p>
      <div className="mt-6">
        <ReciboCajaTab canApprovePayments={canApprovePayments} />
      </div>
    </div>
  );
}
