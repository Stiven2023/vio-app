import { redirect } from "next/navigation";

export default function FactoringPage() {
  redirect("/erp/accounting-module?tab=receivables");
}
