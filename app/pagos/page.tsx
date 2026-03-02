import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { requirePermission } from "@/src/utils/permission-middleware";
import { PaymentsHubClient } from "@/app/pagos/_components/payments-hub-client";

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

  const forbiddenView = await requirePermission(req, "VER_PAGO");
  if (forbiddenView) redirect("/unauthorized");

  const canCreate = !(await requirePermission(req, "CREAR_PAGO"));
  const canEdit = !(await requirePermission(req, "EDITAR_PAGO"));

  const sp = (await searchParams) ?? {};
  const rawOrderId = Array.isArray(sp.orderId) ? sp.orderId[0] : sp.orderId;
  const initialOrderId = String(rawOrderId ?? "").trim() || undefined;

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Pagos</h1>
      <p className="text-default-600 mt-1">
        Gestión centralizada de pagos por pedido y abonos distribuidos.
      </p>
      <div className="mt-6">
        <PaymentsHubClient
          canCreate={canCreate}
          canEdit={canEdit}
          initialOrderId={initialOrderId}
        />
      </div>
    </div>
  );
}
