export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { BackToAccountingButton } from "../_components/back-to-accounting-button";
import { WithholdingsTab } from "../retenciones/_components/withholdings-tab";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function ConfiguracionRetencionesPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_RETENCIONES",
    "GESTIONAR_RETENCIONES",
  ]);

  if (!perms.VER_RETENCIONES || !perms.GESTIONAR_RETENCIONES) {
    redirect("/unauthorized");
  }

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <div className="mb-4">
        <BackToAccountingButton />
      </div>
      <h1 className="text-2xl font-bold">Withholding Configuration</h1>
      <p className="mt-1 text-default-600">
        Central accounting section to manage withholding rates by tax zone.
      </p>
      <div className="mt-6">
        <WithholdingsTab canManageRates hidePrefacturasTab initialTab="rates" />
      </div>
    </div>
  );
}
