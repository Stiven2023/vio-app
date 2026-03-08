import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { QuotationEditor } from "@/app/erp/quotations/_components/QuotationEditor";
import { requirePermission } from "@/src/utils/permission-middleware";

export default async function NewPrefacturaPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "CREAR_PEDIDO");
  if (forbidden) redirect("/unauthorized");

  return <QuotationEditor mode="prefactura" />;
}
