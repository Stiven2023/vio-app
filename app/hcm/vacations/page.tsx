export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function VacationsPage() {
  redirect("/erp/under-construction?modulo=hcm&area=vacations");
}
