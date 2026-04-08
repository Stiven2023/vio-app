export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { checkPermissions } from "@/src/utils/permission-middleware";
import { BackToAccountingButton } from "../_components/back-to-accounting-button";
import { SupplierInvoicesTab } from "./_components/supplier-invoices-tab";

export default async function FacturasProveedorPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_FACTURAS_PROVEEDOR",
    "EDITAR_FACTURA_PROVEEDOR",
  ]);

  if (!perms.VER_FACTURAS_PROVEEDOR) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <div className="mb-4">
        <BackToAccountingButton />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Supplier Invoices</h1>
          <p className="mt-1 text-default-600">
            Type F: send to SIIGO. Type R: generate remision document.
          </p>
        </div>
      </div>
      <div className="mt-6">
        <SupplierInvoicesTab canEdit={perms.EDITAR_FACTURA_PROVEEDOR} />
      </div>
    </div>
  );
}
