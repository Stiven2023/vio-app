"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import {
  MdCheckCircle,
  MdListAlt,
  MdError,
  MdRefresh,
  MdSchedule,
  MdWarning,
} from "react-icons/md";

type QueueItem = {
  id: string;
  orderId: string;
  orderItemId: string;
  design: string;
  size: string | null;
  quantityTotal: number;
  priority: "URGENTE" | "NORMAL" | "BAJA";
  finalOrder: number;
  suggestedOrder: number;
  status: "EN_COLA" | "EN_PROCESO" | "COMPLETADO";
  confirmedAt: string | null;
  orderCode: string;
  clientName: string | null;
  deliveryDate: string | null;
};

const PRIORITY_CONFIG: Record<
  "URGENTE" | "NORMAL" | "BAJA",
  { label: string; color: "danger" | "warning" | "default" }
> = {
  URGENTE: { label: "URGENTE", color: "danger" },
  NORMAL: { label: "NORMAL", color: "warning" },
  BAJA: { label: "BAJA", color: "default" },
};

export function MesProductionQueueTab() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [settingUrgent, setSettingUrgent] = useState<string | null>(null);
  const isConfirmed = items.some((item) => item.confirmedAt !== null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mes/production-queue");
      if (!res.ok) throw new Error("No se pudo cargar la cola");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      toast.error("No se pudo cargar la cola de producción");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markUrgent = async (itemId: string) => {
    if (settingUrgent) return;
    setSettingUrgent(itemId);
    try {
      const res = await fetch(`/api/mes/production-queue/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: "URGENTE" }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar la prioridad");
      toast.success("Marcado como URGENTE");
      await load();
    } catch {
      toast.error("No se pudo marcar como urgente");
    } finally {
      setSettingUrgent(null);
    }
  };

  const confirmQueue = async () => {
    if (confirming) return;
    if (items.length === 0) {
      toast.error("La cola está vacía");
      return;
    }
    setConfirming(true);
    try {
      const res = await fetch("/api/mes/production-queue/confirm", {
        method: "POST",
      });
      if (!res.ok) throw new Error("No se pudo confirmar la cola");
      const data = await res.json();
      toast.success(`Cola confirmada. ${data.confirmed} tickets activados para Montaje.`);
      await load();
    } catch {
      toast.error("No se pudo confirmar la cola de producción");
    } finally {
      setConfirming(false);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <section className="space-y-4 rounded-medium border border-default-200 bg-content1 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Cola de Producción</h2>
          <p className="text-xs text-default-500">
            Define el orden de los pedidos antes de activar el proceso de Montaje.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            radius="sm"
            size="sm"
            startContent={<MdRefresh />}
            variant="flat"
            onPress={() => void load()}
          >
            Actualizar
          </Button>
          <Button
            color={isConfirmed ? "success" : "primary"}
            isLoading={confirming}
            radius="sm"
            size="sm"
            startContent={isConfirmed ? <MdCheckCircle /> : <MdListAlt />}
            onPress={() => void confirmQueue()}
          >
            {isConfirmed ? "Cola confirmada ✓" : "Confirmar cola"}
          </Button>
        </div>
      </div>

      {isConfirmed ? (
        <Card className="border border-success-200 bg-success-50" radius="sm" shadow="none">
          <CardBody className="flex flex-row items-center gap-2 py-2 px-3">
            <MdCheckCircle className="text-success shrink-0" size={16} />
            <p className="text-xs text-success-700">
              La cola fue confirmada. Los tickets de Montaje están activos.
              Los URGENTES siempre aparecen primero.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card className="border border-warning-200 bg-warning-50" radius="sm" shadow="none">
          <CardBody className="flex flex-row items-center gap-2 py-2 px-3">
            <MdWarning className="text-warning shrink-0" size={16} />
            <p className="text-xs text-warning-700">
              La cola no ha sido confirmada. Ningún proceso puede iniciar tickets hasta que confirmes.
            </p>
          </CardBody>
        </Card>
      )}

      <Divider className="opacity-60" />

      {loading ? (
        <Card className="border border-dashed border-divider" radius="md" shadow="none">
          <CardBody className="py-12 flex items-center justify-center">
            <div className="text-center text-default-400">
              <MdSchedule className="mx-auto mb-2 animate-spin" size={36} />
              <p className="text-sm">Cargando cola de producción...</p>
            </div>
          </CardBody>
        </Card>
      ) : items.length === 0 ? (
        <Card className="border border-dashed border-divider" radius="md" shadow="none">
          <CardBody className="py-12 flex items-center justify-center">
            <div className="text-center text-default-400">
              <MdError className="mx-auto mb-2 opacity-40" size={36} />
              <p className="text-sm">No hay pedidos en la cola de producción</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="rounded-medium border border-default-200 overflow-x-auto">
          <Table removeWrapper aria-label="Cola de producción">
            <TableHeader>
              <TableColumn>Orden</TableColumn>
              <TableColumn>Pedido</TableColumn>
              <TableColumn>Diseño</TableColumn>
              <TableColumn>Talla</TableColumn>
              <TableColumn>Cantidad</TableColumn>
              <TableColumn>F. Entrega</TableColumn>
              <TableColumn>Prioridad</TableColumn>
              <TableColumn>Acciones</TableColumn>
            </TableHeader>
            <TableBody items={items}>
              {(item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="text-sm font-mono font-semibold text-default-600">
                      #{item.finalOrder}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium">{item.orderCode}</p>
                      <p className="text-xs text-default-400">{item.clientName ?? "-"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs">{item.design}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs">{item.size ?? "-"}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-medium">{item.quantityTotal}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs">{formatDate(item.deliveryDate)}</p>
                  </TableCell>
                  <TableCell>
                    <Chip
                      color={PRIORITY_CONFIG[item.priority].color}
                      size="sm"
                      variant="flat"
                    >
                      {PRIORITY_CONFIG[item.priority].label}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    {item.priority !== "URGENTE" ? (
                      <Button
                        color="danger"
                        isLoading={settingUrgent === item.id}
                        size="sm"
                        variant="flat"
                        onPress={() => void markUrgent(item.id)}
                      >
                        Marcar URGENTE
                      </Button>
                    ) : (
                      <Chip color="danger" size="sm" variant="flat">
                        URGENTE ↑
                      </Chip>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
