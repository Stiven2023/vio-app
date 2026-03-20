import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PilaTab } from "./_components/pila-tab";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function PilaPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, ["VER_PILA", "GENERAR_PILA"]);

  if (!perms.VER_PILA) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Social Security (PILA)</h1>
      <p className="mt-1 text-default-600">
        Liquidación de aportes de seguridad social por período con base en provisiones de nómina.
      </p>
      <div className="mt-6">
        <PilaTab canGenerate={Boolean(perms.GENERAR_PILA)} />
      </div>
    </div>
  );
}
