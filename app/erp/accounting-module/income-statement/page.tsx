import { redirect } from "next/navigation";

export default function IncomeStatementPage() {
  redirect("/erp/accounting-module?tab=close-control");
}
