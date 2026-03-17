import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ProgramacionItemsTable } from "@/app/erp/programacion/_components/programacion-items-table";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function AprobacionInicialPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_PEDIDO");
  if (forbidden) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Aprobación</h1>
      <p className="text-default-600 mt-1">Pedidos agrupados por pedido en estado APROBACION, sectorizados por proceso.</p>
      <div className="mt-6">
        <ProgramacionItemsTable
          process="PRODUCCION"
          orderStatus="APROBACION"
          showProcessColumn
          basePath="/aprobacion-inicial"
          actualizacionBasePath="/aprobacion-inicial/actualizacion"
          enableDecisions
          labels={{
            principal: "Aprobación principal",
            bodega: "Aprobación bodega",
            compras: "Aprobación compras",
          }}
        />
      </div>
    </div>
  );
}
