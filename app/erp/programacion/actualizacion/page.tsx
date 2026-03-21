import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ProgramacionItemsTable } from "@/app/erp/programacion/_components/programacion-items-table";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function ProgramacionActualizacionPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_PEDIDO");

  if (forbidden) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Scheduling - Update</h1>
      <p className="text-default-600 mt-1">
        Orders grouped by order with changes after entering production.
      </p>
      <div className="mt-6">
        <ProgramacionItemsTable
          actualizacionQueue="PROGRAMACION"
          basePath="/erp/programacion/actualizacion"
          groupByOrder={false}
          labels={{
            principal: "Main Scheduling",
            bodega: "Warehouse Scheduling",
            compras: "Purchasing Scheduling",
          }}
          orderStatus="PRODUCCION"
          process="PRODUCCION"
          view="ACTUALIZACION"
        />
      </div>
    </div>
  );
}
