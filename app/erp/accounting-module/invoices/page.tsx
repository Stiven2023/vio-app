import { redirect } from "next/navigation";

export default function InvoicesPage() {
  redirect("/erp/accounting-module?tab=docs");
}
