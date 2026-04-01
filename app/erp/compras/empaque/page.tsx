export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function ComprasEmpaquePage() {
  redirect("/erp/purchase-orders");
}
