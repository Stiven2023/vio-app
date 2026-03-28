import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { SiigoJobsTab } from "@/app/erp/contabilidad/siigo-jobs/_components/siigo-jobs-tab";
import { verifyAuthToken } from "@/src/utils/auth";
import { checkPermissions } from "@/src/utils/permission-middleware";

const ACCOUNTING_ROLES = new Set([
  "ADMINISTRADOR",
  "LIDER_FINANCIERA",
  "AUXILIAR_CONTABLE",
  "TESORERIA_Y_CARTERA",
]);

export default async function SiigoJobsPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const payload = verifyAuthToken(token);
  const role =
    payload && typeof payload === "object"
      ? (payload as { role?: unknown }).role
      : null;

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, ["VER_PAGO"]);

  if (!perms.VER_PAGO) redirect("/unauthorized");

  if (!(typeof role === "string" && ACCOUNTING_ROLES.has(role))) {
    redirect("/unauthorized");
  }

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Siigo sync jobs</h1>
      <p className="mt-1 text-default-600">
        Monitor synchronization jobs and retry failed executions.
      </p>
      <div className="mt-6">
        <SiigoJobsTab />
      </div>
    </div>
  );
}
