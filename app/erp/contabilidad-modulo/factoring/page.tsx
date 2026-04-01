export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { FactoringTab } from "./_components/factoring-tab";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function FactoringPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_FACTORING",
    "CREAR_FACTORING",
  ]);

  if (!perms.VER_FACTORING) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Factoring</h1>
      <p className="mt-1 text-default-600">
        Manage pre-invoice factoring assignments and final collection status.
      </p>
      <div className="mt-6">
        <FactoringTab canCreate={Boolean(perms.CREAR_FACTORING)} />
      </div>
    </div>
  );
}
