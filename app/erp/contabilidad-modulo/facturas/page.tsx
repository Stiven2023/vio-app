export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default async function FacturasPage() {
  redirect("/erp/contabilidad-modulo/prefacturas-workflow");
}
