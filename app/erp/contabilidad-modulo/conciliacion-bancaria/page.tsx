export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { BankReconciliationTab } from "./_components/bank-reconciliation-tab";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function BankReconciliationPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_CONCILIACION_BANCARIA",
    "CREAR_CONCILIACION_BANCARIA",
    "CERRAR_CONCILIACION_BANCARIA",
  ]);

  if (!perms.VER_CONCILIACION_BANCARIA) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
      <p className="mt-1 text-default-600">
        Review and organize bank movements by period for subsequent
        reconciliation.
      </p>
      <div className="mt-6">
        <BankReconciliationTab
          canClose={Boolean(perms.CERRAR_CONCILIACION_BANCARIA)}
          canCreate={Boolean(perms.CREAR_CONCILIACION_BANCARIA)}
        />
      </div>
    </div>
  );
}
