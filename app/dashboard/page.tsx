import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyAuthToken } from "@/src/utils/auth";

export default async function DashboardPage() {
  const token = (await cookies()).get("auth_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;

  if (!payload) redirect("/login");

  const role =
    payload && typeof payload === "object"
      ? (payload as { role?: unknown }).role
      : null;
  const roleName = typeof role === "string" ? role : "";
  const overrideRole = (await cookies()).get("role_override")?.value ?? "";
  const effectiveRole =
    process.env.NODE_ENV !== "production" && roleName === "ADMINISTRADOR"
      ? overrideRole || roleName
      : roleName;
  if (effectiveRole === "ADMINISTRADOR") {
    redirect("/dashboard/admin");
  }

  if (effectiveRole) {
    redirect(`/dashboard/role/${encodeURIComponent(effectiveRole)}`);
  }

  redirect("/unauthorized");

  return null;
}
