import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PrefacturaPage } from "./_components/prefactura-page";

import { requirePermission } from "@/src/utils/permission-middleware";

export default async function PrefacturaRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_PEDIDO");

  if (forbidden) redirect("/dashboard");

  const { id } = await params;

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <PrefacturaPage orderId={id} />
    </div>
  );
}
