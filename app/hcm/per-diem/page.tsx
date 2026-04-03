export const dynamic = "force-dynamic";

import { HcmModuleRequestsTab } from "../_components/hcm-module-requests-tab";

export default function Page() {
  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <HcmModuleRequestsTab
        defaultType="SOLICITUD"
        description="Solicitud y consulta de viaticos para desplazamientos laborales."
        moduleKey="PER_DIEM"
        title="HCM | Viaticos"
      />
    </div>
  );
}
