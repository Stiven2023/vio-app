import { redirect } from "next/navigation";


export const dynamic = "force-dynamic";

export default function AccountsReceivablePage() {
  redirect("/erp/accounting-module?tab=receivables");
}
