import { redirect } from "next/navigation";

export default function DepositsPage() {
  redirect("/erp/accounting-module?tab=cash-banks");
}
