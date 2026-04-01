export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { AccountingHubTabs } from "./_components/accounting-hub-tabs";
import {
  ACCOUNTING_HUB_COPY,
  buildAccountingHubGroups,
  hasAccountingHubAccess,
  resolveAccountingLocale,
} from "./_lib/hub";

import { checkPermissions } from "@/src/utils/permission-middleware";

type AccessMap = Record<string, boolean>;

export default async function AccountingLandingPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });
  const locale = resolveAccountingLocale(
    (await cookies()).get("NEXT_LOCALE")?.value,
  );
  const copy = ACCOUNTING_HUB_COPY[locale];

  const perms = (await checkPermissions(req, [
    "VER_PEDIDO",
    "VER_RECIBO_CAJA",
    "VER_CONCILIACION_BANCARIA",
    "VER_RETENCIONES",
    "VER_FACTORING",
    "VER_CARTERA",
    "VER_ESTADO_RESULTADOS",
    "VER_CAJA_MENOR",
  ])) as AccessMap;

  const visibleGroups = buildAccountingHubGroups(locale, perms);
  const hasAnyAccess = hasAccountingHubAccess(perms);

  if (!hasAnyAccess) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16 pb-10 space-y-6">
      <header className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{copy.pageTitle}</h1>
            <p className="text-default-600">{copy.pageDescription}</p>
          </div>
          <a
            className="inline-flex items-center justify-center rounded-medium border border-default-300 bg-content2 px-4 py-2 text-sm font-medium transition hover:border-primary hover:text-primary"
            href="/api/contabilidad/formato-pruebas?format=csv"
          >
            Descargar formato de prueba (CSV)
          </a>
        </div>
      </header>

      <Suspense fallback={<div className="text-sm text-default-500">{copy.loading}</div>}>
        <AccountingHubTabs
          ariaLabel={copy.navigationAriaLabel}
          groups={visibleGroups}
        />
      </Suspense>
    </div>
  );
}
