export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function BanksAccountingPage() {
  redirect("/erp/maestros/bancos");
}
