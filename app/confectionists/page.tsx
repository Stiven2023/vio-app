import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ConfectionistsTab } from "./_components/confectionists-tab";

import { requirePermission } from "@/src/utils/permission-middleware";

export default async function ConfectionistsPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_CONFECCIONISTA");

  if (forbidden) redirect("/dashboard");

  const canCreate = !(await requirePermission(req, "CREAR_CONFECCIONISTA"));
  const canEdit = !(await requirePermission(req, "EDITAR_CONFECCIONISTA"));
  const canDelete = !(await requirePermission(req, "ELIMINAR_CONFECCIONISTA"));

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Confeccionistas</h1>
      <p className="text-default-600 mt-1">
        Consulta y gestiona la información de confeccionistas.
      </p>
      <div className="mt-6">
        <ConfectionistsTab
          canCreate={canCreate}
          canDelete={canDelete}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
