import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AdminClient } from "./admin-client";

import { verifyAuthToken } from "@/src/utils/auth";

export default async function AdminPage() {
  const token = (await cookies()).get("auth_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;

  if (!payload || typeof payload !== "object") redirect("/login");
  const role =
    "role" in payload ? (payload as { role?: string }).role : undefined;

  if (role !== "ADMINISTRADOR") redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Administración</h1>
      <p className="text-default-600 mt-1">
        Gestiona usuarios, empleados, clientes, roles, permisos y sus
        relaciones.
      </p>
      <div className="mt-6">
        <AdminClient />
      </div>
    </div>
  );
}
