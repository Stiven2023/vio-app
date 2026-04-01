export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { StatusHistoryClient } from "./status-history-client";

import { requirePermission } from "@/src/utils/permission-middleware";

export default async function StatusHistoryPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_HISTORIAL_ESTADO");

  if (forbidden) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <h1 className="text-2xl font-bold">Status History</h1>
      <p className="text-default-600 mt-1">
        Review status changes for orders and designs.
      </p>
      <div className="mt-6">
        <Suspense fallback={<div className="text-sm text-default-500">Cargando...</div>}>
          <StatusHistoryClient />
        </Suspense>
      </div>
    </div>
  );
}
