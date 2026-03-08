import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import RegisterUser from "@/components/register-user";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function RegisterUserPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "CREAR_USUARIO");

  if (forbidden) redirect("/unauthorized");

  return <RegisterUser />;
}
