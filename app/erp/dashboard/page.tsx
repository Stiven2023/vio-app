import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ExchangeRateWidget } from "@/app/erp/dashboard/_components/exchange-rate-widget";
import { DashboardSectionsSkeleton } from "@/app/erp/dashboard/_components/dashboard-sections-skeleton";
import { getLatestUsdCopRatePair, getUsdCopRateHistory } from "@/src/utils/exchange-rate";
import { verifyAuthToken } from "@/src/utils/auth";

export default async function DashboardPage() {
  const token = (await cookies()).get("auth_token")?.value;
  const payload = token ? verifyAuthToken(token) : null;

  if (!payload) redirect("/login");

  const rates = await getLatestUsdCopRatePair();
  const history = await getUsdCopRateHistory(45);
  const latest = rates.latest;
  const previous = rates.previous;

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-default-500">
          Vista unica con secciones internas: KPIs, SLA, Estados de resultados y Comisiones.
        </p>
      </header>

      <section id="dolar-card" className="scroll-mt-24">
        <ExchangeRateWidget
          pairLabel="USD/COP"
          baseLabel="TRM base"
          currentRate={latest?.effectiveRate ?? null}
          previousRate={previous?.effectiveRate ?? null}
          provider={latest?.provider ?? "datos.gov.co (TRM Colombia)"}
          sourceRate={latest?.sourceRate ?? null}
          floorRate={latest?.floorRate ?? 3600}
          adjustmentApplied={latest?.adjustmentApplied ?? null}
          history={history}
        />
      </section>

      <DashboardSectionsSkeleton />
    </div>
  );
}
