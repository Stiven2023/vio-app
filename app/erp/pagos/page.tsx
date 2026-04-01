export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { checkPermissions } from "@/src/utils/permission-middleware";
import { PaymentsHubClient } from "@/app/erp/pagos/_components/payments-hub-client";

export default async function PagosPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_PAGO",
    "CREAR_PAGO",
    "EDITAR_PAGO",
    "APROBAR_PAGO",
  ]);

  if (!perms.VER_PAGO) redirect("/unauthorized");

  const canCreate = perms.CREAR_PAGO;
  const canEdit = perms.EDITAR_PAGO;
  const canApprove = perms.APROBAR_PAGO;

  const sp = (await searchParams) ?? {};
  const rawOrderId = Array.isArray(sp.orderId) ? sp.orderId[0] : sp.orderId;
  const initialOrderId = String(rawOrderId ?? "").trim() || undefined;

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Payments</h1>
      <p className="text-default-600 mt-1">
        Centralized payment management by order and distributed deposits.
      </p>
      <div className="mt-6">
        <PaymentsHubClient
          canApprove={canApprove}
          canCreate={canCreate}
          canEdit={canEdit}
          initialOrderId={initialOrderId}
        />
      </div>
    </div>
  );
}
