export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function ExtractosBancariosPage() {
  redirect("/erp/contabilidad-modulo/conciliacion-bancaria");
}