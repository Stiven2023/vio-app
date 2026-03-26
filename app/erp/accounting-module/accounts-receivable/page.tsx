import { redirect } from "next/navigation";

export default function AccountsReceivablePage() {
  redirect("/erp/accounting-module?tab=receivables");
}
