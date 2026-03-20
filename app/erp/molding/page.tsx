import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { MoldingTemplatesTab } from "./_components/molding-templates-tab";
import { MoldingPurchaseNeedsTab } from "./_components/molding-purchase-needs-tab";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function MoldingPage() {
  const token = (await cookies()).get("auth_token")?.value;
  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_MOLDERIA",
    "CREAR_MOLDERIA",
    "EDITAR_MOLDERIA",
    "ELIMINAR_MOLDERIA",
  ]);

  if (!perms.VER_MOLDERIA) redirect("/unauthorized");

  const canCreate = Boolean(perms.CREAR_MOLDERIA);
  const canEdit = Boolean(perms.EDITAR_MOLDERIA);
  const canDelete = Boolean(perms.ELIMINAR_MOLDERIA);

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Molding Templates</h1>
      <p className="mt-1 text-default-600">
        Manage versioned molding templates, supply items (insumos), and track
        purchase needs per order.
      </p>

      <div className="mt-6 space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Templates catalog</h2>
          <MoldingTemplatesTab
            canCreate={canCreate}
            canDelete={canDelete}
            canEdit={canEdit}
          />
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Pending purchases</h2>
          <MoldingPurchaseNeedsTab />
        </section>
      </div>
    </div>
  );
}
