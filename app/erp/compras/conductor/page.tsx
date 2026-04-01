export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function ComprasConductorPage() {
  redirect("/erp/purchase-orders");
}
