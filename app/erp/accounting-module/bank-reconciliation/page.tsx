import { redirect } from "next/navigation";

export default function BankReconciliationPage() {
  redirect("/erp/accounting-module?tab=cash-banks");
}
