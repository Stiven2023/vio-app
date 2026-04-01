export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default async function PrefacturasPage() {
  redirect("/erp/pre-invoices");
}
