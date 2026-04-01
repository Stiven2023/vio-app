export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function PerDiemPage() {
  redirect("/erp/under-construction?modulo=hcm&area=per-diem");
}
