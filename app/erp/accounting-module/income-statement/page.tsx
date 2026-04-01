import { redirect } from "next/navigation";


export const dynamic = "force-dynamic";

export default function IncomeStatementPage() {
  redirect("/erp/accounting-module?tab=close-control");
}
