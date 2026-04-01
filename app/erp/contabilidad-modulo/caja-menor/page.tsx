export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PettyCashTab } from "./_components/petty-cash-tab";
import { PETTY_CASH_COPY } from "./_lib/petty-cash.constants";

import { resolveAccountingLocale } from "@/app/erp/contabilidad-modulo/_lib/hub";

import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function CajaMenorPage() {
  const token = (await cookies()).get("auth_token")?.value;
  const locale = resolveAccountingLocale(
    (await cookies()).get("NEXT_LOCALE")?.value,
  );
  const copy = PETTY_CASH_COPY[locale];

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_CAJA_MENOR",
    "CREAR_CAJA_MENOR",
    "GESTIONAR_CAJA_MENOR",
  ]);

  if (!perms.VER_CAJA_MENOR) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">{copy.pageTitle}</h1>
      <p className="mt-1 text-default-600">{copy.pageDescription}</p>
      <div className="mt-6">
        <PettyCashTab
          canCreate={Boolean(perms.CREAR_CAJA_MENOR)}
          canManage={Boolean(perms.GESTIONAR_CAJA_MENOR)}
        />
      </div>
    </div>
  );
}
