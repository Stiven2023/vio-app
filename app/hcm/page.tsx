export const dynamic = "force-dynamic";

import Link from "next/link";

import { CertificationsPanel } from "./_components/certifications-panel";
import { EmployeeSchedulePanel } from "./_components/employee-schedule-panel";

export default function Page() {
  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-6 pt-16">
      <div>
        <h1 className="text-2xl font-bold">HCM | Portal del empleado</h1>
        <p className="mt-1 text-default-600">
          Consulta tu horario semanal/mensual, certificados y tramites de talento humano.
        </p>
      </div>

      <EmployeeSchedulePanel />
      <CertificationsPanel />

      <div className="rounded-medium border border-default-200 p-4 text-sm">
        Integracion RH-HCM: para vista administrativa del calendario completo por empleado,
        revisa <Link className="font-semibold underline" href="/hr/permisos-ausencias"> RH Permisos y Ausencias</Link>.
      </div>
    </div>
  );
}
