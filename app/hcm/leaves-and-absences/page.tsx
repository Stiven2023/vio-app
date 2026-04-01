export const dynamic = "force-dynamic";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { EmployeeLeavesTab } from "./_components/employee-leaves-tab";
import { checkPermissions } from "@/src/utils/permission-middleware";

export default async function LeavesAndAbsencesPage() {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) redirect("/login");

  const req = new Request("http://localhost", {
    headers: new Headers(await headers()),
  });

  const perms = await checkPermissions(req, [
    "VER_PERMISOS_EMPLEADO",
    "APROBAR_PERMISO_EMPLEADO",
  ]);

  if (!perms.VER_PERMISOS_EMPLEADO) redirect("/unauthorized");

  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <h1 className="text-2xl font-bold">Leaves and Absences</h1>
      <p className="mt-1 text-default-600">
        Register and track employee absences, including payroll impact and
        monthly summary.
      </p>
      <div className="mt-6">
        <EmployeeLeavesTab
          canManage={Boolean(perms.APROBAR_PERMISO_EMPLEADO)}
        />
      </div>
    </div>
  );
}
