export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function NonCompliancePage() {
  redirect("/erp/under-construction?modulo=hcm&area=non-compliance");
}
