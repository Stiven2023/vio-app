import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { JuridicaClient } from "@/app/juridica/_components/juridica-client";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";

const ALLOWED_ROLES = new Set(["ADMINISTRADOR", "LIDER_JURIDICA"]);

export default async function JuridicaPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const role = getRoleFromRequest(req);

  if (!role || !ALLOWED_ROLES.has(role)) {
    redirect("/unauthorized");
  }

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6 pb-12">
      <h1 className="text-2xl font-bold">Área Jurídica</h1>
      <p className="text-default-600 mt-1">
        Gestión del estado jurídico de clientes. Solo el área jurídica puede
        modificar estos estados.
      </p>
      <div className="mt-6">
        <JuridicaClient />
      </div>
    </div>
  );
}
