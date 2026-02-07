import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import LoginUser from "@/components/login-user";
import { verifyAuthToken } from "@/src/utils/auth";

export default async function LoginPage() {
  const token = (await cookies()).get("auth_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;

  if (payload) redirect("/dashboard");

  return <LoginUser />;
}
