import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { WithholdingsTab } from "./_components/withholdings-tab";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function RetencionesPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_RETENCIONES",
    "GESTIONAR_RETENCIONES",
  ]);

  if (!perms.VER_RETENCIONES) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Withholdings</h1>
      <p className="mt-1 text-default-600">
        Review withholdings by pre-invoice and manage tax-zone rates.
      </p>
      <div className="mt-6">
        <WithholdingsTab
          canManageRates={Boolean(perms.GESTIONAR_RETENCIONES)}
        />
      </div>
    </div>
  );
}
