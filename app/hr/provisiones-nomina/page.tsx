export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PayrollProvisionsTab } from "./_components/payroll-provisions-tab";
import {
  HR_PROVISIONES_NOMINA_PERMISSIONS,
  getProvisionesNominaPageCopy,
} from "./_services/provisiones-nomina.service";
import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function Page() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, HR_PROVISIONES_NOMINA_PERMISSIONS);

  if (!perms.VER_PROVISIONES_NOMINA) redirect("/unauthorized");

  const copy = getProvisionesNominaPageCopy();

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">{copy.title}</h1>
      <p className="mt-1 text-default-600">{copy.description}</p>
      <div className="mt-6">
        <PayrollProvisionsTab canCreate={Boolean(perms.CREAR_PROVISIONES_NOMINA)} />
      </div>
    </div>
  );
}
