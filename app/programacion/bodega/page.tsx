import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ProgramacionItemsTable } from "../_components/programacion-items-table";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function ProgramacionBodegaPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_PEDIDO");
  if (forbidden) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Programación Bodega</h1>
      <p className="text-default-600 mt-1">Items en proceso BODEGA.</p>
      <div className="mt-6">
        <ProgramacionItemsTable process="BODEGA" />
      </div>
    </div>
  );
}
