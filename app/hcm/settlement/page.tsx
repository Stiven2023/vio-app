export const dynamic = "force-dynamic";

import { HcmModuleRequestsTab } from "../_components/hcm-module-requests-tab";

export default function Page() {
  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <HcmModuleRequestsTab
        defaultType="SOLICITUD"
        description="Gestion de solicitudes y validaciones para liquidacion de contratos."
        moduleKey="SETTLEMENT"
        title="HCM | Liquidaciones"
      />
    </div>
  );
}
