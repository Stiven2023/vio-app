import { cookies } from "next/headers";

import { CrmSkeleton } from "./_components/crm-skeleton";
import { ModuleLogo } from "@/components/module-logo";

const CRM_COPY = {
  en: { description: "Client management, commercial opportunities and sales pipeline." },
  es: { description: "Gestión de clientes, oportunidades comerciales y pipeline de ventas." },
} as const;

export default async function CrmModulePage() {
  const locale = (await cookies()).get("NEXT_LOCALE")?.value === "en" ? "en" : "es";
  const copy = CRM_COPY[locale];

  return (
    <div className="container mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6">
      {/* Module header */}
      <div className="mb-8 flex items-center gap-4">
        <ModuleLogo active module="crm" size={52} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--viomar-primary)]">
            Customer Relationship Management
          </p>
          <h1 className="text-2xl font-black tracking-tight">CRM</h1>
          <p className="text-sm text-default-500">{copy.description}</p>
        </div>
      </div>

      <CrmSkeleton />
    </div>
  );
}
