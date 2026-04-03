export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { HrAdminClient } from "./_components/hr-admin-client";
import { checkPermissions } from "@/src/utils/permission-middleware";

const HR_COPY = {
  en: {
    pageTitle: "Human Resources",
    pageDescription: "Manage leave requests, absences, petitions and PQR for all employees.",
  },
  es: {
    pageTitle: "Recursos Humanos",
    pageDescription: "Gestiona los permisos, ausencias, peticiones y PQR de todos los empleados.",
  },
} as const;

export default async function HrPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, ["VER_PERMISOS_EMPLEADO"]);

  if (!perms.VER_PERMISOS_EMPLEADO) redirect("/erp/unauthorized");

  const locale = cookieStore.get("NEXT_LOCALE")?.value === "en" ? "en" : "es";
  const copy = HR_COPY[locale];

  return (
    <div className="container mx-auto max-w-7xl px-4 pt-16 pb-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{copy.pageTitle}</h1>
        <p className="mt-1 text-default-500">{copy.pageDescription}</p>
      </div>
      <HrAdminClient />
    </div>
  );
}
