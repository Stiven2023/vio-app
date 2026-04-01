import { redirect } from "next/navigation";


export const dynamic = "force-dynamic";

export default function PreInvoicesPage() {
  redirect("/erp/accounting-module?tab=docs");
}
