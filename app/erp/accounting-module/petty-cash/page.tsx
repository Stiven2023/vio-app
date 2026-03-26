import { redirect } from "next/navigation";

export default function PettyCashPage() {
  redirect("/erp/accounting-module?tab=close-control");
}
