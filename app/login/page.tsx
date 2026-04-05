import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import LoginUser from "@/components/login-user";
import {
  verifyAuthToken,
  verifyExternalAccessToken,
  verifyMesAccessToken,
} from "@/src/utils/auth";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  const externalToken = cookieStore.get("external_access_token")?.value;
  const mesToken = cookieStore.get("mes_access_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;
  const externalPayload = externalToken
    ? verifyExternalAccessToken(externalToken)
    : null;
  const mesPayload = mesToken ? verifyMesAccessToken(mesToken) : null;

  if (payload) redirect("/");
  if (mesPayload) redirect("/mes");
  if (externalPayload) redirect("/portal/pedidos");

  return <LoginUser />;
}
