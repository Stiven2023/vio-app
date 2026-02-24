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
  const forbiddenItems = await requirePermission(req, "VER_ITEM_INVENTARIO");

  if (forbiddenInventory && forbiddenItems) redirect("/unauthorized");

  const canViewInventoryItems = !forbiddenItems;

  const canCreateItem = !(await requirePermission(req, "CREAR_ITEM_INVENTARIO"));
  const canEditItem = !(await requirePermission(req, "EDITAR_ITEM_INVENTARIO"));
  const canDeleteItem = !(await requirePermission(req, "ELIMINAR_ITEM_INVENTARIO"));
  const canEntry = !(await requirePermission(req, "REGISTRAR_ENTRADA"));
  const canOutput = !(await requirePermission(req, "REGISTRAR_SALIDA"));

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Catálogo</h1>
      <p className="text-default-600 mt-1">
        Gestiona productos con precios, categorías e inventario.
      </p>
      <div className="mt-6">
        <CatalogTabs
          canCreateItem={canCreateItem}
          canDeleteItem={canDeleteItem}
          canEditItem={canEditItem}
          canEntry={canEntry}
          canOutput={canOutput}
          canViewInventoryItems={canViewInventoryItems}
        />
      </div>
    </div>
  );
}
