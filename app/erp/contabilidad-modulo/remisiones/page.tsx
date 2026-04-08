export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default async function RemisionesPage() {
  redirect("/erp/contabilidad-modulo/prefacturas-workflow");
}
