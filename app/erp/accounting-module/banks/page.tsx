import { redirect } from "next/navigation";


export const dynamic = "force-dynamic";

export default function BanksPage() {
  redirect("/erp/accounting-module?tab=cash-banks");
}
