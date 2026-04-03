export const dynamic = "force-dynamic";

import { HcmModuleRequestsTab } from "../_components/hcm-module-requests-tab";

export default function Page() {
  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <HcmModuleRequestsTab
        defaultType="PERMISO"
        description="Registro de solicitudes de horas extra y novedades de turno."
        moduleKey="OVERTIME"
        title="HCM | Horas extra"
      />
    </div>
  );
}
