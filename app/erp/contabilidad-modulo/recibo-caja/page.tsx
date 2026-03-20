import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ReciboCajaTab } from "./_components/recibo-caja-tab";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function ReciboCajaPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_RECIBO_CAJA",
    "CREAR_RECIBO_CAJA",
    "ANULAR_RECIBO_CAJA",
  ]);

  if (!perms.VER_RECIBO_CAJA) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Cash Receipts</h1>
      <p className="mt-1 text-default-600">
        Register, confirm and void cash receipts applied to open pre-invoices.
      </p>
      <div className="mt-6">
        <ReciboCajaTab
          canCreate={Boolean(perms.CREAR_RECIBO_CAJA)}
          canVoid={Boolean(perms.ANULAR_RECIBO_CAJA)}
        />
      </div>
    </div>
  );
}
