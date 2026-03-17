import { ModuleLogo } from "@/components/module-logo";

export default function CrmModulePage() {
  return (
    <div className="container mx-auto max-w-5xl px-6 py-12">
      <div className="overflow-hidden rounded-[2rem] border border-default-200/60 bg-content1 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
        <div className="grid gap-8 p-8 md:grid-cols-[180px_minmax(0,1fr)] md:p-10">
          <div className="flex items-center justify-center rounded-[1.6rem] bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--viomar-primary)_16%,transparent),transparent_65%)]">
            <ModuleLogo active module="crm" size={156} />
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--viomar-primary)]">
              Customer Relationship Management
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-foreground">CRM</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-default-600">
              Este modulo concentrara clientes, oportunidades, seguimiento comercial y coordinacion de servicio sobre una sola vista de relacion.
            </p>
            <p className="mt-3 text-sm text-default-500">
              Dejé el logo alineado con el selector principal y con la entrada de login para que el sistema se vea coherente en todos los accesos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
