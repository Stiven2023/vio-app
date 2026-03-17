import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PackersTab } from "./_components/packers-tab";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function PackersPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_EMPAQUE",
    "CREAR_EMPAQUE",
    "EDITAR_EMPAQUE",
    "ELIMINAR_EMPAQUE",
  ]);

  if (!perms.VER_EMPAQUE) redirect("/unauthorized");

  const canCreate = perms.CREAR_EMPAQUE;
  const canEdit = perms.EDITAR_EMPAQUE;
  const canDelete = perms.ELIMINAR_EMPAQUE;

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Empaque</h1>
      <p className="text-default-600 mt-1">
        Consulta y gestiona la información de empacadores.
      </p>
      <div className="mt-6">
        <PackersTab
          canCreate={canCreate}
          canDelete={canDelete}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
