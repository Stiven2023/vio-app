import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { SuppliersTab } from "./_components/suppliers-tab";

import { requirePermission } from "@/src/utils/permission-middleware";

export default async function SuppliersPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_PROVEEDOR");

  if (forbidden) redirect("/dashboard");

  const canCreate = !(await requirePermission(req, "CREAR_PROVEEDOR"));
  const canEdit = !(await requirePermission(req, "EDITAR_PROVEEDOR"));
  const canDelete = !(await requirePermission(req, "ELIMINAR_PROVEEDOR"));

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Proveedores</h1>
      <p className="text-default-600 mt-1">
        Consulta y gestiona la información de proveedores.
      </p>
      <div className="mt-6">
        <SuppliersTab
          canCreate={canCreate}
          canDelete={canDelete}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
