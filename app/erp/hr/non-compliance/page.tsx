export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function NonCompliancePage() {
  redirect("/erp/hr/incumplimiento");
}
