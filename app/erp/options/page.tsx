import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { OptionsPageClient } from "./_components/options-page-client";
import { verifyAuthToken } from "@/src/utils/auth";

export default async function OptionsPage() {
  const token = (await cookies()).get("auth_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;

  if (!payload) redirect("/login");

  return <OptionsPageClient />;
}
