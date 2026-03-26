import { redirect } from "next/navigation";

export default function CashReceiptPage() {
  redirect("/erp/accounting-module?tab=cash-banks");
}
