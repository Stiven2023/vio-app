export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function CommissionsPage() {
  redirect("/erp/under-construction?modulo=hcm&area=commissions");
}
