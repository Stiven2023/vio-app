import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ClientsTab } from "@/app/erp/admin/_components/clients/clients-tab";
import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function ClientsPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_CLIENTE",
    "CREAR_CLIENTE",
    "EDITAR_CLIENTE",
    "ELIMINAR_CLIENTE",
    "CAMBIAR_ESTADO_JURIDICO_CLIENTE",
  ]);

  if (!perms.VER_CLIENTE) redirect("/unauthorized");

  const canCreate = perms.CREAR_CLIENTE;
  const canEdit = perms.EDITAR_CLIENTE;
  const canDelete = perms.ELIMINAR_CLIENTE;
  const canChangeLegalStatus = perms.CAMBIAR_ESTADO_JURIDICO_CLIENTE;

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Clients</h1>
      <p className="text-default-600 mt-1">
        View and manage client information.
      </p>
      <div className="mt-6">
        <ClientsTab
          canCreate={canCreate}
          canDelete={canDelete}
          canEdit={canEdit}
          canChangeLegalStatus={canChangeLegalStatus}
        />
      </div>
    </div>
  );
}
