export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { PurchaseOrdersCoordinationClient } from "./coordination-client";

import { requirePermission } from "@/src/utils/permission-middleware";

export default async function PurchaseOrdersCoordinationPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "CREAR_ORDEN_COMPRA");

  if (forbidden) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pb-10 pt-16">
      <PurchaseOrdersCoordinationClient />
    </div>
  );
}
