import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PrefacturasTab } from "@/app/prefacturas/_components/prefacturas-tab";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function PrefacturasPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_PEDIDO");
  if (forbidden) redirect("/unauthorized");

  const canCreate = !(await requirePermission(req, "CREAR_PEDIDO"));
  const canEdit = !(await requirePermission(req, "EDITAR_PEDIDO"));
  const canDelete = !(await requirePermission(req, "ELIMINAR_PEDIDO"));

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Prefacturas</h1>
      <p className="text-default-600 mt-1">Consulta y gestiona prefacturas.</p>
      <div className="mt-6">
        <PrefacturasTab
          canCreate={canCreate}
          canDelete={canDelete}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
