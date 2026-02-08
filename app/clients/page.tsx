import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ClientsTab } from "@/app/admin/_components/clients/clients-tab";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function ClientsPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_CLIENTE");

  if (forbidden) redirect("/unauthorized");

  const canCreate = !(await requirePermission(req, "CREAR_CLIENTE"));
  const canEdit = !(await requirePermission(req, "EDITAR_CLIENTE"));
  const canDelete = !(await requirePermission(req, "ELIMINAR_CLIENTE"));

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Clientes</h1>
      <p className="text-default-600 mt-1">
        Consulta y gestiona la información de clientes.
      </p>
      <div className="mt-6">
        <ClientsTab
          canCreate={canCreate}
          canDelete={canDelete}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
