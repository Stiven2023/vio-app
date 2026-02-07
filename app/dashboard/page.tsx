import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyAuthToken } from "@/src/utils/auth";

export default async function DashboardPage() {
  const token = (await cookies()).get("auth_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;

  if (!payload) redirect("/login");

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p>
        Bienvenido al panel principal. Solo usuarios autenticados pueden ver
        esto.
      </p>
    </div>
  );
}
