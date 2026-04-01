import { redirect } from "next/navigation";


export const dynamic = "force-dynamic";

export default function BankReconciliationPage() {
  redirect("/erp/accounting-module?tab=cash-banks");
}
