export const dynamic = "force-dynamic";

import { HcmModuleRequestsTab } from "../_components/hcm-module-requests-tab";

export default function Page() {
  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <HcmModuleRequestsTab
        defaultType="PERMISO"
        description="Solicitud y seguimiento de vacaciones del empleado."
        moduleKey="VACATIONS"
        title="HCM | Vacaciones"
      />
    </div>
  );
}
