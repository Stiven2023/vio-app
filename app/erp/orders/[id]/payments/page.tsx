import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { requirePermission } from "@/src/utils/permission-middleware";

export default async function OrderPaymentsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_PAGO");

  if (forbidden) redirect("/unauthorized");

  const { id } = await params;

  redirect(`/pagos?orderId=${encodeURIComponent(id)}`);
}
