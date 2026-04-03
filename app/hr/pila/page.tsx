export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PilaTab } from "./_components/pila-tab";
import { HR_PILA_PERMISSIONS, getPilaPageCopy } from "./_services/pila.service";
import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function Page() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, HR_PILA_PERMISSIONS);

  if (!perms.VER_PILA) redirect("/unauthorized");

  const copy = getPilaPageCopy();

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">{copy.title}</h1>
      <p className="mt-1 text-default-600">{copy.description}</p>
      <div className="mt-6">
        <PilaTab canGenerate={Boolean(perms.GENERAR_PILA)} />
      </div>
    </div>
  );
}
