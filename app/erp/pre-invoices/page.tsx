export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PrefacturasTab } from "@/app/erp/prefacturas/_components/prefacturas-tab";
import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function PreInvoicesPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_PEDIDO",
    "CREAR_PEDIDO",
    "EDITAR_PEDIDO",
    "ELIMINAR_PEDIDO",
    "CAMBIAR_ESTADO_PEDIDO",
  ]);

  if (!perms.VER_PEDIDO) redirect("/unauthorized");

  const canCreate = perms.CREAR_PEDIDO;
  const canEdit = perms.EDITAR_PEDIDO;
  const canDelete = perms.ELIMINAR_PEDIDO;
  const canChangeStatus = perms.CAMBIAR_ESTADO_PEDIDO;

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Pre-invoices</h1>
      <p className="text-default-600 mt-1">Review and manage pre-invoices.</p>
      <div className="mt-6">
        <PrefacturasTab
          canChangeStatus={canChangeStatus}
          canCreate={canCreate}
          canDelete={canDelete}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
