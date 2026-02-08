import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import RegisterEmployee from "@/components/register-employee";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function RegisterEmployeePage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "CREAR_EMPLEADO");

  if (forbidden) redirect("/unauthorized");

  return <RegisterEmployee />;
}
