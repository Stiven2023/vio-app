import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { CatalogTabs } from "@/app/catalog/_components/catalog-tabs";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function CatalogPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_INVENTARIO");

  if (forbidden) redirect("/dashboard");

  const canCreate = !(await requirePermission(req, "CREAR_ITEM_INVENTARIO"));
  const canEdit = !(await requirePermission(req, "EDITAR_ITEM_INVENTARIO"));
  const canDelete = !(await requirePermission(req, "ELIMINAR_ITEM_INVENTARIO"));

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Catálogo</h1>
      <p className="text-default-600 mt-1">
        Gestiona productos, categorías y precios.
      </p>
      <div className="mt-6">
        <CatalogTabs
          canCreate={canCreate}
          canDelete={canDelete}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
