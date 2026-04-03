export const dynamic = "force-dynamic";

import { HcmModuleRequestsTab } from "../_components/hcm-module-requests-tab";

export default function Page() {
  return (
    <div className="container mx-auto max-w-7xl px-6 pt-16">
      <HcmModuleRequestsTab
        defaultType="RECLAMO"
        description="Gestion de reportes de incumplimientos y novedades disciplinarias."
        moduleKey="NON_COMPLIANCE"
        title="HCM | Incumplimientos"
      />
    </div>
  );
}
