import { redirect } from "next/navigation";


export const dynamic = "force-dynamic";

export default function PettyCashPage() {
  redirect("/erp/accounting-module?tab=close-control");
}
