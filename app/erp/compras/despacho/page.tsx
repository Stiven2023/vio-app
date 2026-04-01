export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function ComprasDespachoPage() {
  redirect("/erp/purchase-orders");
}
