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

  const forbiddenInventory = await requirePermission(req, "VER_INVENTARIO");
  if (forbiddenInventory) redirect("/unauthorized");

  const canCreateItem = !(await requirePermission(req, "CREAR_ITEM_INVENTARIO"));
  const canEditItem = !(await requirePermission(req, "EDITAR_ITEM_INVENTARIO"));
  const canDeleteItem = !(await requirePermission(req, "ELIMINAR_ITEM_INVENTARIO"));

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Catálogo</h1>
      <p className="text-default-600 mt-1">
        Gestiona productos, adiciones y categorías.
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
