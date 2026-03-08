import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { NotificationsPage } from "./_components/notifications-page";


export default async function NotificationsRoute() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  return (
    <div className="container mx-auto max-w-7xl pt-16 px-6">
      <NotificationsPage />
    </div>
  );
}
