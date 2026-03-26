import { redirect } from "next/navigation";

export default function BankStatementsPage() {
  redirect("/erp/accounting-module?tab=cash-banks");
}