"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@heroui/button";
import { toast } from "react-hot-toast";

type ExchangeRateWidgetProps = {
  pairLabel: string;
  baseLabel: string;
  currentRate: number | null;
  previousRate: number | null;
  provider: string;
  sourceRate: number | null;
  floorRate: number;
  adjustmentApplied: number | null;
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
  } = props;

  const router = useRouter();
  const [updating, setUpdating] = useState(false);
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
    <div className="rounded-medium border border-default-200 bg-content1 p-3">
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
          No hay tasa registrada todavía. Presiona “Actualizar ahora”.
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
  );
}
