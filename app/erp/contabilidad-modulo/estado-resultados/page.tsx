import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { IncomeStatementTab } from "./_components/income-statement-tab";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function EstadoResultadosPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, ["VER_ESTADO_RESULTADOS"]);

  if (!perms.VER_ESTADO_RESULTADOS) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Estado de Resultados</h1>
      <p className="mt-1 text-default-600">
        Análisis financiero: ingresos, costos de ventas, nómina y utilidad operacional por período.
      </p>
      <div className="mt-6">
        <IncomeStatementTab />
      </div>
    </div>
  );
}

