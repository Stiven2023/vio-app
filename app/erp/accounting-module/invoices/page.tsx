import { redirect } from "next/navigation";


export const dynamic = "force-dynamic";

export default function InvoicesPage() {
  redirect("/erp/accounting-module?tab=docs");
}
