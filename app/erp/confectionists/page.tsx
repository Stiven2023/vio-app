export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ConfectionistsTab } from "./_components/confectionists-tab";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function ConfectionistsPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_CONFECCIONISTA",
    "CREAR_CONFECCIONISTA",
    "EDITAR_CONFECCIONISTA",
    "ELIMINAR_CONFECCIONISTA",
  ]);

  if (!perms.VER_CONFECCIONISTA) redirect("/unauthorized");

  const canCreate = perms.CREAR_CONFECCIONISTA;
  const canEdit = perms.EDITAR_CONFECCIONISTA;
  const canDelete = perms.ELIMINAR_CONFECCIONISTA;

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Confectionists</h1>
      <p className="text-default-600 mt-1">
        View and manage confectionist information.
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
