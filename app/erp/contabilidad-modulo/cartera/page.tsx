export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { CarteraTab } from "./_components/cartera-tab";
import { ACCOUNTS_RECEIVABLE_COPY } from "./_lib/cartera.constants";

import { resolveAccountingLocale } from "@/app/erp/contabilidad-modulo/_lib/hub";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function CarteraPage() {
  const token = (await cookies()).get("auth_token")?.value;
  const locale = resolveAccountingLocale(
    (await cookies()).get("NEXT_LOCALE")?.value,
  );
  const copy = ACCOUNTS_RECEIVABLE_COPY[locale];

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_CARTERA",
    "EXPORTAR_CARTERA",
  ]);

  if (!perms.VER_CARTERA) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">{copy.pageTitle}</h1>
      <p className="mt-1 text-default-600">{copy.pageDescription}</p>
      <div className="mt-6">
        <CarteraTab canExport={Boolean(perms.EXPORTAR_CARTERA)} />
      </div>
    </div>
  );
}
