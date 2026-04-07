import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { MesOperarioLogin } from "@/app/mes/_components/mes-operario-login";
import { verifyAuthToken, verifyMesAccessToken } from "@/src/utils/auth";

export default async function MesLoginPage() {
  const cookieStore = await cookies();
  const authToken = cookieStore.get("auth_token")?.value;
  const mesToken = cookieStore.get("mes_access_token")?.value;
  const authPayload = authToken ? verifyAuthToken(authToken) : null;
  const mesPayload = mesToken ? verifyMesAccessToken(mesToken) : null;

  if (authPayload || mesPayload) {
    redirect("/mes");
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pb-6 pt-8 sm:px-6 lg:px-8">
      <MesOperarioLogin />
    </div>
  );
}