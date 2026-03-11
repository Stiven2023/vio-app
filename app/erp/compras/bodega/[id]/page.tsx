import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { WarehouseDetailsClient } from "./warehouse-details-client";

import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function WarehouseDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const role = getRoleFromRequest(req);
  const allowedRole = role === "ADMINISTRADOR" || role === "LIDER_SUMINISTROS";

  if (!allowedRole) {
    redirect("/unauthorized");
  }

  const forbidden = await requirePermission(req, "VER_INVENTARIO");

  if (forbidden) {
    redirect("/unauthorized");
  }

  const { id } = await params;

  if (!id) redirect("/erp/compras/bodega");

  return <WarehouseDetailsClient id={id} />;
}
