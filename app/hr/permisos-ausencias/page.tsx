export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { EmployeeLeavesTab } from "./_components/employee-leaves-tab";
import { EmployeeScheduleCalendar } from "./_components/employee-schedule-calendar";
import {
  HR_PERMISOS_AUSENCIAS_PERMISSIONS,
  getPermisosAusenciasPageCopy,
} from "./_services/permisos-ausencias.service";
import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function Page() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, HR_PERMISOS_AUSENCIAS_PERMISSIONS);

  if (!perms.VER_PERMISOS_EMPLEADO) redirect("/unauthorized");

  const copy = getPermisosAusenciasPageCopy();

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">{copy.title}</h1>
      <p className="mt-1 text-default-600">{copy.description}</p>
      <div className="mt-6">
        <EmployeeLeavesTab canManage={Boolean(perms.APROBAR_PERMISO_EMPLEADO)} />
      </div>
      <div className="mt-8">
        <EmployeeScheduleCalendar />
      </div>
    </div>
  );
}
