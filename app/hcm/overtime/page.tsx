export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function OvertimePage() {
  redirect("/erp/under-construction?modulo=hcm&area=overtime");
}
