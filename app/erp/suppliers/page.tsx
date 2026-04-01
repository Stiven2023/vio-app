export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { SuppliersTab } from "./_components/suppliers-tab";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function SuppliersPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_PROVEEDOR",
    "CREAR_PROVEEDOR",
    "EDITAR_PROVEEDOR",
    "ELIMINAR_PROVEEDOR",
  ]);

  if (!perms.VER_PROVEEDOR) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Suppliers</h1>
      <p className="text-default-600 mt-1">
        View and manage supplier information.
      </p>
      <div className="mt-6">
        <SuppliersTab
          canCreate={perms.CREAR_PROVEEDOR}
          canDelete={perms.ELIMINAR_PROVEEDOR}
          canEdit={perms.EDITAR_PROVEEDOR}
        />
      </div>
    </div>
  );
}
