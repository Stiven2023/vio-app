import { Card, CardBody, CardHeader } from "@heroui/card";
import { Skeleton } from "@heroui/skeleton";

type SectionConfig = {
  id: "kpis" | "sla" | "estados-resultados" | "comisiones";
  title: string;
  subtitle: string;
};

const sections: SectionConfig[] = [
  {
    id: "kpis",
    title: "KPIs",
    subtitle: "Indicadores clave del periodo",
  },
  {
    id: "sla",
    title: "SLA",
    subtitle: "Cumplimiento y tiempos objetivo",
  },
  {
    id: "estados-resultados",
    title: "Estados de resultados",
    subtitle: "Vista consolidada financiera",
  },
  {
    id: "comisiones",
    title: "Comisiones",
    subtitle: "Resumen de comisiones por periodo",
  },
];

function SectionSkeleton({ section }: { section: SectionConfig }) {
  return (
    <article className="scroll-mt-24" id={section.id}>
      <Card className="border border-default-200 bg-content1/80">
        <CardHeader className="flex flex-col items-start gap-1 pb-1">
          <h2 className="text-base font-semibold">{section.title}</h2>
          <p className="text-xs text-default-500">{section.subtitle}</p>
        </CardHeader>
        <CardBody className="gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, idx) => (
              <div
                key={`${section.id}-metric-${idx}`}
                className="rounded-large border border-default-100 p-3"
              >
                <Skeleton className="h-3 w-20 rounded-medium" />
                <Skeleton className="mt-3 h-7 w-28 rounded-medium" />
                <Skeleton className="mt-2 h-3 w-24 rounded-medium" />
              </div>
            ))}
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <div className="rounded-large border border-default-100 p-3">
              <Skeleton className="h-4 w-36 rounded-medium" />
              <Skeleton className="mt-3 h-56 w-full rounded-large" />
            </div>
            <div className="rounded-large border border-default-100 p-3">
              <Skeleton className="h-4 w-40 rounded-medium" />
              <Skeleton className="mt-3 h-56 w-full rounded-large" />
            </div>
          </div>
        </CardBody>
      </Card>
    </article>
  );
}

export function DashboardSectionsSkeleton() {
  return (
    <section className="space-y-5">
      {sections.map((section) => (
        <SectionSkeleton key={section.id} section={section} />
      ))}
    </section>
  );
}
