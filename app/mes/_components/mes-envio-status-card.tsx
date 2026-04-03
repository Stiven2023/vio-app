"use client";

/**
 * MesEnvioStatusCard — Muestra los envíos de un pedido y permite actualizar su estado.
 * Usado en secciones: Integración, Confección, Despacho.
 */
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Divider } from "@heroui/divider";

type EnvioItem = {
  id: string;
  envioId: string;
  orderItemId: string;
  quantity: number;
  notes: string | null;
  itemName: string | null;
};

type ApprovalStep = {
  approved: boolean;
  approverName: string | null;
  approvedAt: string | null;
  notes: string | null;
};

type Envio = {
  id: string;
  origenArea: string;
  origenNombre: string | null;
  destinoArea: string;
  destinoNombre: string | null;
  transporteTipo: string;
  transportistaNombre: string | null;
  empresaTercero: string | null;
  guiaNumero: string | null;
  placa: string | null;
  requiereSegundaParada: boolean;
  segundaParadaTipo: string | null;
  segundaParadaDestino: string | null;
  observaciones: string | null;
  dispatchApprovals?: {
    seller?: ApprovalStep | null;
    cartera?: ApprovalStep | null;
    accounting?: ApprovalStep | null;
    partial?: ApprovalStep | null;
  } | null;
  status: string;
  salidaAt: string | null;
  llegadaAt: string | null;
  retornoAt: string | null;
  createdAt: string;
  items: EnvioItem[];
};
const STATUS_COLOR: Record<
  string,
  "default" | "primary" | "success" | "warning" | "danger"
> = {
  CREADO: "default",
  EN_RUTA: "primary",
  ENTREGADO: "success",
  RETORNADO: "warning",
  INCIDENTE: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  CREADO: "Creado",
  EN_RUTA: "En ruta",
  ENTREGADO: "Entregado",
  RETORNADO: "Retornado",
  INCIDENTE: "Incidente",
};

const TRANSPORT_LABEL: Record<string, string> = {
  MENSAJERO: "Mensajero",
  CONDUCTOR_PROPIO: "Conductor propio",
  LINEA_TERCERO: "Línea tercero",
};

function getErrorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e ?? "Error");
}

async function readApiErrorMessage(response: Response, fallback: string) {
  try {
    const payload = await response.json();

    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
  } catch {}

  try {
    const text = await response.text();

    if (text.trim()) return text.trim();
  } catch {}

  return fallback;
}

function formatTs(ts: string | null) {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export type MesEnvioStatusCardProps = {
  orderId: string;
  /** Only show envíos where destino or origen matches this area filter */
  areaFilter?: string;
  onEnvioUpdated?: () => void;
};

export function MesEnvioStatusCard({
  orderId,
  areaFilter,
  onEnvioUpdated,
}: MesEnvioStatusCardProps) {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const refresh = () => {
    if (!orderId) return;
    let active = true;
    setLoading(true);
    fetch(`/api/mes/envios?orderId=${orderId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        let items: Envio[] = data.items ?? [];
        if (areaFilter) {
          const f = areaFilter.toUpperCase();
          items = items.filter(
            (e) =>
              e.origenArea === f ||
              e.destinoArea === f,
          );
        }
        setEnvios(items);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  };

  useEffect(refresh, [orderId, areaFilter]);

  const updateStatus = async (envioId: string, status: string) => {
    if (updatingId) return;
    try {
      setUpdatingId(envioId);
      const res = await fetch(`/api/mes/envios/${envioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        throw new Error(
          await readApiErrorMessage(res, "No se pudo actualizar el envío."),
        );
      }
      toast.success(`Estado actualizado: ${STATUS_LABEL[status] ?? status}`);
      refresh();
      onEnvioUpdated?.();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <Spinner size="sm" />;
  if (envios.length === 0) return null;

  return (
    <div className="space-y-3">
      {envios.map((envio) => (
        <Card key={envio.id} className="border border-default-200">
          <CardBody className="gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {envio.origenNombre ?? envio.origenArea} →{" "}
                  {envio.destinoNombre ?? envio.destinoArea}
                </p>
                <p className="text-xs text-default-500">
                  {TRANSPORT_LABEL[envio.transporteTipo] ?? envio.transporteTipo}
                  {envio.transportistaNombre
                    ? ` — ${envio.transportistaNombre}`
                    : ""}
                  {envio.empresaTercero ? ` (${envio.empresaTercero})` : ""}
                  {envio.placa ? ` | Placa: ${envio.placa}` : ""}
                  {envio.guiaNumero ? ` | Guía: ${envio.guiaNumero}` : ""}
                </p>
                {envio.requiereSegundaParada && (
                  <p className="text-xs text-warning-600">
                    2ª parada:{" "}
                    {envio.segundaParadaTipo
                      ? `${envio.segundaParadaTipo} — `
                      : ""}
                    {envio.segundaParadaDestino ?? ""}
                  </p>
                )}
                <div className="flex gap-3 text-xs text-default-400">
                  <span>Salida: {formatTs(envio.salidaAt)}</span>
                  <span>Llegada: {formatTs(envio.llegadaAt)}</span>
                  {envio.retornoAt && (
                    <span>Retorno: {formatTs(envio.retornoAt)}</span>
                  )}
                </div>
                {envio.observaciones && (
                  <p className="text-xs text-default-500 italic">
                    {envio.observaciones}
                  </p>
                )}
                {envio.dispatchApprovals ? (
                  <div className="flex flex-wrap gap-2 text-xs text-default-500">
                    {envio.dispatchApprovals.seller?.approved ? (
                      <Chip size="sm" variant="flat" color="success">
                        Vendedor: {envio.dispatchApprovals.seller.approverName ?? "OK"}
                      </Chip>
                    ) : null}
                    {envio.dispatchApprovals.cartera?.approved ? (
                      <Chip size="sm" variant="flat" color="success">
                        Cartera: {envio.dispatchApprovals.cartera.approverName ?? "OK"}
                      </Chip>
                    ) : null}
                    {envio.dispatchApprovals.accounting?.approved ? (
                      <Chip size="sm" variant="flat" color="success">
                        Contabilidad: {envio.dispatchApprovals.accounting.approverName ?? "OK"}
                      </Chip>
                    ) : null}
                    {envio.dispatchApprovals.partial?.approved ? (
                      <Chip size="sm" variant="flat" color="warning">
                        Parcial: {envio.dispatchApprovals.partial.approverName ?? "OK"}
                      </Chip>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <Chip
                color={STATUS_COLOR[envio.status] ?? "default"}
                size="sm"
                variant="flat"
              >
                {STATUS_LABEL[envio.status] ?? envio.status}
              </Chip>
            </div>

            {/* Diseños incluidos */}
            {envio.items.length > 0 && (
              <>
                <Divider />
                <div className="flex flex-wrap gap-1">
                  {envio.items.map((item) => (
                    <Chip key={item.id} size="sm" variant="bordered">
                      {item.itemName ?? item.orderItemId} ×{item.quantity}
                    </Chip>
                  ))}
                </div>
              </>
            )}

            {/* Acciones de estado */}
            <div className="flex flex-wrap gap-2 pt-1">
              {envio.status === "CREADO" && (
                <Button
                  color="primary"
                  isLoading={updatingId === envio.id}
                  size="sm"
                  variant="flat"
                  onPress={() => updateStatus(envio.id, "EN_RUTA")}
                >
                  Marcar en ruta
                </Button>
              )}
              {envio.status === "EN_RUTA" && (
                <>
                  <Button
                    color="success"
                    isLoading={updatingId === envio.id}
                    size="sm"
                    variant="flat"
                    onPress={() => updateStatus(envio.id, "ENTREGADO")}
                  >
                    Confirmar entrega
                  </Button>
                  <Button
                    color="warning"
                    isLoading={updatingId === envio.id}
                    size="sm"
                    variant="flat"
                    onPress={() => updateStatus(envio.id, "RETORNADO")}
                  >
                    Registrar retorno a Viomar
                  </Button>
                  <Button
                    color="danger"
                    isLoading={updatingId === envio.id}
                    size="sm"
                    variant="flat"
                    onPress={() => updateStatus(envio.id, "INCIDENTE")}
                  >
                    Incidente
                  </Button>
                </>
              )}
              {envio.status === "ENTREGADO" && (
                <Button
                  color="warning"
                  isLoading={updatingId === envio.id}
                  size="sm"
                  variant="flat"
                  onPress={() => updateStatus(envio.id, "RETORNADO")}
                >
                  Registrar retorno a Viomar
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
