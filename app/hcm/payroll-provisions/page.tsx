export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PayrollProvisionsTab } from "./_components/payroll-provisions-tab";
import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function PayrollProvisionsPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_PROVISIONES_NOMINA",
    "CREAR_PROVISIONES_NOMINA",
  ]);

  if (!perms.VER_PROVISIONES_NOMINA) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Payroll Provisions</h1>
      <p className="mt-1 text-default-600">
        Management of labor provisions: severance, interest, bonuses, vacation
        and social security.
      </p>
      <div className="mt-6">
        <PayrollProvisionsTab
          canCreate={Boolean(perms.CREAR_PROVISIONES_NOMINA)}
        />
      </div>
    </div>
  );
}
