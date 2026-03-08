import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function ErpEntryPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (token) {
    redirect("/erp/dashboard");
  }

  redirect("/login");
}
