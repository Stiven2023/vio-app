import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { BanksTab } from "@/app/erp/maestros/bancos/_components/banks-tab";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function BanksAccountingPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbiddenView = await requirePermission(req, "VER_PAGO");

  if (forbiddenView) redirect("/unauthorized");

  const canManage = !(await requirePermission(req, "CREAR_PAGO"));

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Bancos</h1>
      <p className="mt-1 text-default-600">
        Consulta, crea, edita y revisa el historial de asociación de bancos a pagos.
      </p>
      <div className="mt-6">
        <BanksTab canManage={canManage} />
      </div>
    </div>
  );
}
