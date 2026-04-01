import { redirect } from "next/navigation";


export const dynamic = "force-dynamic";

export default function WithholdingsPage() {
  redirect("/erp/accounting-module?tab=docs");
}
