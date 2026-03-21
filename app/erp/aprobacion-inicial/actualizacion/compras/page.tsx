import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ProgramacionItemsTable } from "@/app/erp/programacion/_components/programacion-items-table";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function AprobacionInicialActualizacionComprasPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_PEDIDO");

  if (forbidden) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Approval Update — Purchases</h1>
      <p className="text-default-600 mt-1">
        Approve design changes in PURCHASING process and send them to Scheduling
        - Update.
      </p>
      <div className="mt-6">
        <ProgramacionItemsTable
          enableDecisions
          actualizacionBasePath="/aprobacion-inicial/actualizacion"
          actualizacionQueue="APROBACION"
          basePath="/aprobacion-inicial/actualizacion"
          groupByOrder={false}
          labels={{
            principal: "Main Approval",
            bodega: "Warehouse Approval",
            compras: "Purchasing Approval",
          }}
          orderStatus="APROBACION"
          process="COMPRAS"
          view="ACTUALIZACION"
        />
      </div>
    </div>
  );
}
