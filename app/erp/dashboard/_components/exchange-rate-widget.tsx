"use client";

import { useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@heroui/button";
import { toast } from "react-hot-toast";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const ResponsiveContainerBase = ResponsiveContainer as unknown as ComponentType<any>;
const LineChartBase = LineChart as unknown as ComponentType<any>;
const LineBase = Line as unknown as ComponentType<any>;
const XAxisBase = XAxis as unknown as ComponentType<any>;
const YAxisBase = YAxis as unknown as ComponentType<any>;
const TooltipBase = Tooltip as unknown as ComponentType<any>;
const CartesianGridBase = CartesianGrid as unknown as ComponentType<any>;

type ExchangeRateWidgetProps = {
  pairLabel: string;
  baseLabel: string;
  currentRate: number | null;
  previousRate: number | null;
  provider: string;
  sourceRate: number | null;
  floorRate: number;
  adjustmentApplied: number | null;
  history?: Array<{
    value: number;
    at: string | null;
  }>;
};

function formatRate(value: number) {
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ExchangeRateWidget(props: ExchangeRateWidgetProps) {
  const {
    pairLabel,
    baseLabel,
    currentRate,
    previousRate,
    provider,
    sourceRate,
    floorRate,
    adjustmentApplied,
    history = [],
  } = props;

  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [rangeDays, setRangeDays] = useState<7 | 15 | 30>(15);
  const hasCurrentRate = Boolean(currentRate && currentRate > 0);

  const hasPrevious = Boolean(hasCurrentRate && previousRate && previousRate > 0);
  const changePercent = hasPrevious
    ? ((Number(currentRate) - Number(previousRate)) / Number(previousRate)) * 100
    : null;
  const isUp = changePercent !== null && changePercent >= 0;

  const percentClass =
    changePercent === null
      ? "text-default-500"
      : isUp
        ? "text-success"
        : "text-danger";

  const percentText =
    changePercent === null
      ? "N/D"
      : `${isUp ? "↑" : "↓"}${Math.abs(changePercent).toFixed(2)}%`;

  const filteredHistory = useMemo(() => {
    const now = Date.now();
    const cutoff = now - rangeDays * 24 * 60 * 60 * 1000;

    return history.filter((point) => {
      if (!Number.isFinite(point.value) || point.value <= 0) return false;
      if (!point.at) return false;

      const timestamp = new Date(point.at).getTime();

      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });
  }, [history, rangeDays]);

  const chartModel = useMemo(() => {
    const points = filteredHistory;

    if (points.length < 2) {
      return null;
    }
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    const chartData = points.map((point) => {
      const date = point.at ? new Date(point.at) : null;

      return {
        value: point.value,
        dateLabel: date
          ? new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit" }).format(date)
          : "N/D",
      };
    });

    const firstPoint = points[0];
    const lastPoint = points.at(-1);
    const firstDate = firstPoint?.at ? new Date(firstPoint.at) : null;
    const lastDate = lastPoint?.at ? new Date(lastPoint.at) : null;

    const dateFmt = (date: Date | null) =>
      date
        ? new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit" }).format(date)
        : "N/D";

    return {
      min,
      max,
      chartData,
      pointsCount: points.length,
      firstLabel: dateFmt(firstDate),
      lastLabel: dateFmt(lastDate),
    };
  }, [filteredHistory]);

  const onUpdateNow = async () => {
    if (updating) return;

    setUpdating(true);
    try {
      const res = await fetch("/api/exchange-rate/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ floorRate: 3600 }),
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "No se pudo actualizar la tasa");
      }

      const json = (await res.json()) as {
        note?: string;
        message?: string;
        conversionNote?: string;
      };

      const successMessage = [
        json.message || "Tasa actualizada",
        json.note,
        json.conversionNote,
      ]
        .filter(Boolean)
        .join(" · ");

      toast.success(successMessage);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la tasa");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="rounded-medium border border-default-200 bg-content1 p-3 md:p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(520px,1.35fr)]">
        <div>
          <div className="text-xs text-default-500">{pairLabel}</div>
          <div className="mt-1 text-3xl font-semibold leading-tight">
            {hasCurrentRate ? formatRate(Number(currentRate)) : "Sin dato"}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-default-500">{baseLabel}</span>
            <span className={percentClass}>{percentText}</span>
          </div>

          {hasCurrentRate ? (
            <>
              <div className="mt-2 text-[11px] text-default-500">
                TRM: {sourceRate ? formatRate(sourceRate) : "N/D"} · Piso: {formatRate(floorRate)}
              </div>
              <div className="mt-1 text-[11px] text-default-400">
                Ajuste: {adjustmentApplied && adjustmentApplied > 0 ? `+${formatRate(adjustmentApplied)}` : "0.00"} · {provider}
              </div>
            </>
          ) : (
            <div className="mt-2 text-[11px] text-default-400">
              No hay tasa registrada todavia. Presiona "Actualizar ahora".
            </div>
          )}

          <div className="mt-3">
            <Button
              color="primary"
              isLoading={updating}
              size="sm"
              variant="flat"
              onPress={onUpdateNow}
            >
              Actualizar ahora
            </Button>
          </div>
        </div>

        <div className="rounded-medium border border-default-100 bg-default-50/40 p-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-default-600">Historial guardado</div>
            <div className="inline-flex rounded-medium border border-default-200 bg-content1 p-1">
              {[7, 15, 30].map((days) => {
                const isActive = rangeDays === days;

                return (
                  <button
                    key={days}
                    type="button"
                    className={`rounded-small px-2 py-1 text-[11px] font-medium transition ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-default-500 hover:bg-default-100"
                    }`}
                    onClick={() => setRangeDays(days as 7 | 15 | 30)}
                  >
                    {days}d
                  </button>
                );
              })}
            </div>
          </div>
          {chartModel ? (
            <>
              <div className="mt-2 h-56 w-full min-w-0">
                <ResponsiveContainerBase width="100%" height="100%" minWidth={300} minHeight={220}>
                  <LineChartBase data={chartModel.chartData} margin={{ top: 8, right: 12, left: 6, bottom: 4 }}>
                    <CartesianGridBase strokeDasharray="3 3" stroke="var(--viomar-primary-light)" />
                    <XAxisBase
                      dataKey="dateLabel"
                      axisLine={{ stroke: "var(--viomar-fg)" }}
                      tick={{ fill: "var(--viomar-fg)", fontSize: 11 }}
                      tickLine={{ stroke: "var(--viomar-fg)" }}
                    />
                    <YAxisBase
                      axisLine={{ stroke: "var(--viomar-fg)" }}
                      tick={{ fill: "var(--viomar-fg)", fontSize: 11 }}
                      tickLine={{ stroke: "var(--viomar-fg)" }}
                      tickFormatter={(v: number) => formatRate(Number(v ?? 0))}
                      domain={["dataMin - 5", "dataMax + 5"]}
                    />
                    <TooltipBase
                      formatter={(value: number) => formatRate(Number(value ?? 0))}
                      labelFormatter={(label: string) => `Fecha: ${label}`}
                      contentStyle={{
                        backgroundColor: "var(--viomar-bg)",
                        border: "1px solid var(--viomar-primary-light)",
                        borderRadius: 10,
                        color: "var(--viomar-fg)",
                      }}
                      labelStyle={{ color: "var(--viomar-fg)", fontWeight: 600 }}
                      itemStyle={{ color: "var(--viomar-fg)" }}
                    />
                    <LineBase
                      type="monotone"
                      dataKey="value"
                      name="TRM aplicada"
                      stroke="var(--viomar-primary)"
                      strokeWidth={2.5}
                      dot={{ r: 2 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChartBase>
                </ResponsiveContainerBase>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-default-500">
                <span>{chartModel.firstLabel}</span>
                <span>{chartModel.pointsCount} registros ({rangeDays}d)</span>
                <span>{chartModel.lastLabel}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-default-400">
                <span>Min {formatRate(chartModel.min)}</span>
                <span>Max {formatRate(chartModel.max)}</span>
              </div>
            </>
          ) : (
            <div className="mt-3 rounded-small border border-dashed border-default-200 px-3 py-6 text-center text-xs text-default-400">
              Aun no hay suficientes datos para graficar historial.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
