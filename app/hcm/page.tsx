export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { HcmPortalClient } from "./_components/hcm-portal-client";

const HCM_COPY = {
  en: {
    pageTitle: "My portal — HCM",
    pageDescription: "Manage your leave requests, complaints and petitions to HR.",
  },
  es: {
    pageTitle: "Mi portal — HCM",
    pageDescription: "Gestiona tus solicitudes de permiso, reclamos y peticiones a RR.HH.",
  },
} as const;

export default async function HcmPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) redirect("/login");

  const locale = cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "es";
  const copy = HCM_COPY[locale];

  return (
    <div className="container mx-auto max-w-6xl px-4 pt-16 pb-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{copy.pageTitle}</h1>
        <p className="mt-1 text-default-500">{copy.pageDescription}</p>
      </div>
      <HcmPortalClient />
    </div>
  );
}
