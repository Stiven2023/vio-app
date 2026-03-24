"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { toast } from "react-hot-toast";

import type { SiigoTokenStatus } from "@/src/utils/siigo";

type Props = {
  initialStatus: SiigoTokenStatus;
};

function formatDateTime(value: string | null) {
  if (!value) return "No disponible";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "No disponible";

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatBoolean(value: boolean) {
  return value ? "True" : "False";
}

export function SiigoStatusCard({ initialStatus }: Props) {
  const [status, setStatus] = useState<SiigoTokenStatus>(initialStatus);
  const [loading, setLoading] = useState(false);

  const refreshStatus = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const response = await fetch("/api/siigo/auth", {
        method: "GET",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | (SiigoTokenStatus & { error?: string })
        | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error || "No se pudo consultar el estado de Siigo");
      }

      setStatus(payload);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo consultar el estado de Siigo",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border border-default-200 bg-content1">
      <CardHeader className="flex items-center justify-between gap-4">
        <div>
          <div className="text-base font-semibold">Estado API Siigo</div>
          <div className="text-sm text-default-500">
            Evidencia si existe token en cache y desde cuándo está activo.
          </div>
        </div>
        <Chip
          color={status.hasToken ? "success" : "danger"}
          size="sm"
          variant="flat"
        >
          {formatBoolean(status.hasToken)}
        </Chip>
      </CardHeader>
      <CardBody className="gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-medium border border-default-100 bg-default-50/40 p-3">
            <div className="text-xs uppercase tracking-wide text-default-500">
              Token activo
            </div>
            <div className="mt-1 text-lg font-semibold">
              {formatBoolean(status.hasToken)}
            </div>
          </div>
          <div className="rounded-medium border border-default-100 bg-default-50/40 p-3">
            <div className="text-xs uppercase tracking-wide text-default-500">
              Desde cuándo
            </div>
            <div className="mt-1 text-sm font-medium text-default-700">
              {formatDateTime(status.obtainedAt)}
            </div>
          </div>
          <div className="rounded-medium border border-default-100 bg-default-50/40 p-3">
            <div className="text-xs uppercase tracking-wide text-default-500">
              Expira
            </div>
            <div className="mt-1 text-sm font-medium text-default-700">
              {formatDateTime(status.expiresAt)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-default-500">
          <span>
            Base URL: <span className="font-medium text-default-700">{status.baseUrl}</span>
          </span>
          <span>
            TTL restante: <span className="font-medium text-default-700">{status.expiresIn ?? 0}s</span>
          </span>
        </div>

        <div>
          <Button
            isDisabled={loading}
            size="sm"
            variant="flat"
            onPress={refreshStatus}
          >
            {loading ? "Actualizando..." : "Actualizar estado"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}