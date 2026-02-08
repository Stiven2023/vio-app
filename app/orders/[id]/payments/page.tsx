import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { OrderPaymentsPage } from "./_components/order-payments-page";

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

  if (forbidden) redirect("/dashboard");

  const canCreate = !(await requirePermission(req, "CREAR_PAGO"));
  const canEdit = !(await requirePermission(req, "EDITAR_PAGO"));

  const { id } = await params;

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <OrderPaymentsPage canCreate={canCreate} canEdit={canEdit} orderId={id} />
    </div>
  );
}
