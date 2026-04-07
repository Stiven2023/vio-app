export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { MessengersCrudTab } from "@/app/erp/compras/_components/messengers-crud-tab";
import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function ComprasConductorPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, ["VER_PEDIDO", "CREAR_ORDEN_COMPRA"]);

  if (!perms.VER_PEDIDO) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Conductores</h1>
      <p className="mt-1 text-default-600">
        CRUD operativo de conductores para asignación en envíos.
      </p>
      <div className="mt-6">
        <MessengersCrudTab
          canCreate={perms.CREAR_ORDEN_COMPRA}
          canDelete={perms.CREAR_ORDEN_COMPRA}
          canEdit={perms.CREAR_ORDEN_COMPRA}
          defaultType="CONDUCTOR"
        />
      </div>
    </div>
  );
}
