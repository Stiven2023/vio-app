import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { CatalogTabs } from "@/app/erp/catalog/_components/catalog-tabs";
import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function CatalogPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_INVENTARIO",
    "CREAR_ITEM_INVENTARIO",
    "EDITAR_ITEM_INVENTARIO",
    "ELIMINAR_ITEM_INVENTARIO",
  ]);

  if (!perms.VER_INVENTARIO) redirect("/unauthorized");

  const canCreateItem = perms.CREAR_ITEM_INVENTARIO;
  const canEditItem = perms.EDITAR_ITEM_INVENTARIO;
  const canDeleteItem = perms.ELIMINAR_ITEM_INVENTARIO;

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Catalog</h1>
      <p className="text-default-600 mt-1">
        Manage products, additions and categories.
      </p>
      <div className="mt-6">
        <CatalogTabs
          canCreateItem={canCreateItem}
          canDeleteItem={canDeleteItem}
          canEditItem={canEditItem}
        />
      </div>
    </div>
  );
}
