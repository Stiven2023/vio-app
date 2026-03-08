import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PackersTab } from "./_components/packers-tab";

import { requirePermission } from "@/src/utils/permission-middleware";

export default async function PackersPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_EMPAQUE");

  if (forbidden) redirect("/unauthorized");

  const canCreate = !(await requirePermission(req, "CREAR_EMPAQUE"));
  const canEdit = !(await requirePermission(req, "EDITAR_EMPAQUE"));
  const canDelete = !(await requirePermission(req, "ELIMINAR_EMPAQUE"));

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
