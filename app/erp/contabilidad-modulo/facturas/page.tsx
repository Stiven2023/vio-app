export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PrefacturasTab } from "@/app/erp/prefacturas/_components/prefacturas-tab";
import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function FacturasPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_PEDIDO",
    "CREAR_PEDIDO",
    "EDITAR_PEDIDO",
    "ELIMINAR_PEDIDO",
    "CAMBIAR_ESTADO_PEDIDO",
  ]);

  if (!perms.VER_PEDIDO) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Facturas</h1>
          <p className="mt-1 text-default-600">
            Vista operativa de documentos tipo F para revisar estados, bloqueo
            por SIIGO y avance del flujo contable.
          </p>
        </div>
        <a
          className="inline-flex items-center justify-center rounded-medium border border-default-300 bg-content2 px-4 py-2 text-sm font-medium transition hover:border-primary hover:text-primary"
          href="/api/contabilidad/formato-pruebas?format=csv"
        >
          Descargar formato QA
        </a>
      </div>
      <div className="mt-6">
        <PrefacturasTab
          canChangeStatus={perms.CAMBIAR_ESTADO_PEDIDO}
          canCreate={perms.CREAR_PEDIDO}
          canDelete={perms.ELIMINAR_PEDIDO}
          canEdit={perms.EDITAR_PEDIDO}
          initialDocumentType="F"
          lockDocumentTypeFilter
        />
      </div>
    </div>
  );
}
