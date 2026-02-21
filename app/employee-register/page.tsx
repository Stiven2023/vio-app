import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import RegisterEmployee from "@/components/register-employee";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function RegisterEmployeePage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string }>;
}) {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const params = (await searchParams) ?? {};
  const permission = params.id ? "EDITAR_EMPLEADO" : "CREAR_EMPLEADO";

  const forbidden = await requirePermission(req, permission);

  if (forbidden) redirect("/unauthorized");

  return <RegisterEmployee />;
}
