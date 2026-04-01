export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function ErpPermissionsPage() {
  redirect("/erp/admin");
}
