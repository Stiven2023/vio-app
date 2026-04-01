export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function SettlementPage() {
  redirect("/erp/under-construction?modulo=hcm&area=settlement");
}
