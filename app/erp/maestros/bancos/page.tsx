export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { BanksTab } from "@/app/erp/maestros/bancos/_components/banks-tab";
import { checkPermissions } from "@/src/utils/permission-middleware";
import { verifyAuthToken } from "@/src/utils/auth";

const ACCOUNTING_ROLES = new Set([
  "ADMINISTRADOR",
  "LIDER_FINANCIERA",
  "AUXILIAR_CONTABLE",
  "TESORERIA_Y_CARTERA",
]);

export default async function BanksPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const payload = verifyAuthToken(token);
  const role =
    payload && typeof payload === "object"
      ? (payload as { role?: unknown }).role
      : null;

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, ["VER_PAGO", "CREAR_PAGO"]);

  if (!perms.VER_PAGO) redirect("/unauthorized");

  const canManage = perms.CREAR_PAGO;
  const canManageOfficial =
    typeof role === "string" && ACCOUNTING_ROLES.has(role);

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Banks</h1>
      <p className="mt-1 text-default-600">
        View, create, edit and review the history of bank-to-payment
        associations.
      </p>
      <div className="mt-6">
        <BanksTab
          canManage={canManage}
          canManageOfficial={canManageOfficial}
        />
      </div>
    </div>
  );
}
