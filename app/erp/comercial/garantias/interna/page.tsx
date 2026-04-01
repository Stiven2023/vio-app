import { redirect } from "next/navigation";


export const dynamic = "force-dynamic";

export default function Page() {
  redirect("/erp/under-construction?modulo=erp&area=garantias-internas");
}
