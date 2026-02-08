import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { StatusHistoryClient } from "./status-history-client";

import { requirePermission } from "@/src/utils/permission-middleware";

export default async function StatusHistoryPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_HISTORIAL_ESTADO");

  if (forbidden) redirect("/dashboard");

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Historial de estados</h1>
      <p className="text-default-600 mt-1">
        Consulta cambios de estado de pedidos y diseños.
      </p>
      <div className="mt-6">
        <StatusHistoryClient />
      </div>
    </div>
  );
}
