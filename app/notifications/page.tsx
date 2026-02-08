import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { NotificationsPage } from "./_components/notifications-page";

import { requirePermission } from "@/src/utils/permission-middleware";

export default async function NotificationsRoute() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const forbidden = await requirePermission(req, "VER_NOTIFICACION");

  if (forbidden) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <NotificationsPage />
    </div>
  );
}
