"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import {
  Button,
  Card,
  CardBody,
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
  orderCreatedAt?: string | null;
  shippingEnabled?: boolean | null;
  accountingStatus?: string | null;
  advanceReceived?: string | number | null;
  advanceStatus?: string | null;
  productionLeaderName?: string | null;
};

type QueueOrderRow = {
  orderCode: string;
  clientName: string | null;
  deliveryDate: string | null;
  deliveryDateEffective: string | null;
  orderCreatedAt: string | null;
  deliveryType: "ENVIO" | "RETIRO" | "-";
  totalQuantity: number;
  finalOrder: number;
  accountingOk: boolean;
  productionLeader: string;
  productionLeaderOk: boolean;
  isHighPriority: boolean;
  itemIds: string[];
};

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

export function MesProductionQueueTab() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [settingUrgent, setSettingUrgent] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState<number | null>(null);
  const isConfirmed = items.some((item) => item.confirmedAt !== null);

  useEffect(() => {
    setNowTs(Date.now());

    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const toDateMs = (value: string | null | undefined, endOfDay = false): number | null => {
    const raw = String(value ?? "").trim();

    if (!raw) return null;

    const normalized = endOfDay ? `${raw}T23:59:59` : raw;
    const ms = new Date(normalized).getTime();

    return Number.isFinite(ms) ? ms : null;
  };

  const toHourLabel = (hours: number | null): string => {
    if (hours === null || !Number.isFinite(hours)) return "-";

    return `${Math.max(0, Math.round(hours)).toLocaleString("es-CO")} h`;
  };

  const toIsoDateFromUnixSeconds = (seconds: number | null | undefined) => {
    const sec = Number(seconds ?? NaN);

    if (!Number.isFinite(sec) || sec <= 0) return null;

    const d = new Date(sec * 1000);

    if (Number.isNaN(d.getTime())) return null;

    return d.toISOString().slice(0, 10);
  };

  const toAdvanceAmount = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    const raw = String(value)
      .trim()
      .replace(/\./g, "")
      .replace(/,/g, ".");
    const amount = Number(raw);

    return Number.isFinite(amount) ? amount : 0;
  };
  const groupedOrders = useMemo<QueueOrderRow[]>(() => {
    const byOrder = new Map<string, QueueOrderRow>();

    for (const item of items) {
      const orderCode = String(item.orderCode ?? "").trim();

      if (!orderCode) continue;

      const existing = byOrder.get(orderCode);
      const itemPriority = String(item.priority ?? "NORMAL").toUpperCase();
      const accountingStatus = String(item.accountingStatus ?? "")
        .trim()
        .toUpperCase();
      const advanceStatus = String(item.advanceStatus ?? "")
        .trim()
        .toUpperCase();
      const hasFirstAdvance = toAdvanceAmount(item.advanceReceived) > 0;
      const accountingOk =
        hasFirstAdvance ||
        advanceStatus === "RECIBIDO" ||
        advanceStatus === "PAGADO" ||
        (accountingStatus.length > 0 && accountingStatus !== "PENDIENTE_CONTABILIDAD");
      const rawDeliveryDate =
        String(item.deliveryDate ?? "").trim() ||
        toIsoDateFromUnixSeconds(item.suggestedOrder) ||
        null;
      const createdMs = toDateMs(item.orderCreatedAt);
      const rawDeliveryMs = toDateMs(rawDeliveryDate, true);
      const deliveryDateEffective =
        createdMs !== null && rawDeliveryMs !== null && rawDeliveryMs < createdMs
          ? new Date(createdMs).toISOString().slice(0, 10)
          : rawDeliveryDate;
      const productionLeader =
        String(item.productionLeaderName ?? "").trim() || "-";

      if (!existing) {
        byOrder.set(orderCode, {
          orderCode,
          clientName: item.clientName ?? null,
          deliveryDate: item.deliveryDate ?? null,
          deliveryDateEffective,
          orderCreatedAt: item.orderCreatedAt ?? null,
          deliveryType:
            item.shippingEnabled === true
              ? "ENVIO"
              : item.shippingEnabled === false
                ? "RETIRO"
                : "-",
          totalQuantity: Math.max(0, Number(item.quantityTotal ?? 0)),
          finalOrder: Number(item.finalOrder ?? Number.POSITIVE_INFINITY),
          accountingOk,
          productionLeader,
          productionLeaderOk: productionLeader !== "-",
          isHighPriority: itemPriority === "URGENTE",
          itemIds: [item.id],
        });
        continue;
      }

      existing.totalQuantity += Math.max(0, Number(item.quantityTotal ?? 0));
      existing.finalOrder = Math.min(
        existing.finalOrder,
        Number(item.finalOrder ?? Number.POSITIVE_INFINITY),
      );
      if (!existing.orderCreatedAt && item.orderCreatedAt) {
        existing.orderCreatedAt = item.orderCreatedAt;
      }
      if (!existing.deliveryDateEffective && deliveryDateEffective) {
        existing.deliveryDateEffective = deliveryDateEffective;
      }
      if (existing.deliveryType === "-" && item.shippingEnabled !== null && item.shippingEnabled !== undefined) {
        existing.deliveryType = item.shippingEnabled ? "ENVIO" : "RETIRO";
      }
      existing.accountingOk = existing.accountingOk || accountingOk;
      if (existing.productionLeader === "-") {
        existing.productionLeader = productionLeader || existing.productionLeader;
      }
      existing.productionLeaderOk = existing.productionLeader !== "-";
      existing.isHighPriority = existing.isHighPriority || itemPriority === "URGENTE";
      existing.itemIds.push(item.id);
    }

    return Array.from(byOrder.values()).sort((a, b) => {
      if (a.isHighPriority !== b.isHighPriority) {
        return a.isHighPriority ? -1 : 1;
      }

      if (a.finalOrder !== b.finalOrder) {
        return a.finalOrder - b.finalOrder;
      }

      return a.orderCode.localeCompare(b.orderCode);
    });
  }, [items]);

  const timedOrders = useMemo(() => {
    return groupedOrders.map((row) => {
      const createdMs = toDateMs(row.orderCreatedAt);
      const deliveryMs = toDateMs(row.deliveryDateEffective, true);
      const totalHours =
        createdMs !== null && deliveryMs !== null
          ? (deliveryMs - createdMs) / (1000 * 60 * 60)
          : null;
      const remainingHours =
        deliveryMs !== null && nowTs !== null
          ? (deliveryMs - nowTs) / (1000 * 60 * 60)
          : null;

      return {
        ...row,
        totalHours,
        remainingHours,
      };
    });
  }, [groupedOrders, nowTs]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mes/production-queue");

      if (!res.ok) throw new Error("No se pudo cargar la cola");
      const data = await res.json();

      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      toast.error("No se pudo cargar la cola de producción");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markUrgent = async (order: QueueOrderRow) => {
    if (settingUrgent) return;
    setSettingUrgent(order.orderCode);
    try {
      const updates = await Promise.all(
        order.itemIds.map((id) =>
          fetch(`/api/mes/production-queue/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priority: "URGENTE" }),
          }),
        ),
      );

      if (updates.some((res) => !res.ok)) {
        throw new Error("No se pudo actualizar la prioridad");
      }

      toast.success(`Pedido ${order.orderCode} marcado como ALTA prioridad`);
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

      if (!res.ok) {
        throw new Error(
          await readApiErrorMessage(res, "No se pudo confirmar la cola"),
        );
      }
      const data = await res.json();

      toast.success(
        `Cola confirmada. ${data.confirmed} tickets activados para Montaje inicial/final.`,
      );
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "No se pudo confirmar la cola de producción",
      );
    } finally {
      setConfirming(false);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "-";
    const d = new Date(value);

    if (Number.isNaN(d.getTime())) return "-";

    return d.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <section className="space-y-4 rounded-medium border border-default-200 bg-content1 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">
            WORK FLOW - FLUXO DE TRABALHO - TRAVAIL - FLUJO DE TRABAJO
          </h2>
          <p className="text-xs text-default-500">
            Cola por pedido para definir prioridad, validación contable y líder
            de producción antes de iniciar tickets.
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
            isDisabled={confirming}
            radius="sm"
            size="sm"
            startContent={isConfirmed ? <MdCheckCircle /> : <MdListAlt />}
            onPress={() => void confirmQueue()}
          >
            {isConfirmed ? "Cola confirmada ✓" : confirming ? "Confirmando..." : "Confirmar cola"}
          </Button>
        </div>
      </div>

      {isConfirmed ? (
        <Card
          className="border border-success-200 bg-success-50"
          radius="sm"
          shadow="none"
        >
          <CardBody className="flex flex-row items-center gap-2 py-2 px-3">
            <MdCheckCircle className="text-success shrink-0" size={16} />
            <p className="text-xs text-success-700">
              La cola fue confirmada. Montaje inicial/final ya puede operar por
              pedido y descargar la lista de empaque para macro.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card
          className="border border-warning-200 bg-warning-50"
          radius="sm"
          shadow="none"
        >
          <CardBody className="flex flex-row items-center gap-2 py-2 px-3">
            <MdWarning className="text-warning shrink-0" size={16} />
            <p className="text-xs text-warning-700">
              La cola no ha sido confirmada. Ningún proceso puede iniciar
              tickets hasta que confirmes.
            </p>
          </CardBody>
        </Card>
      )}

      <Divider className="opacity-60" />

      <Card className="border border-default-200" radius="sm" shadow="none">
        <CardBody className="py-2 px-3 text-xs text-default-600 space-y-1">
          <p>
            Aprobación base por pedido. Si hay modificación de diseño, solo se
            actualiza ese registro mientras no haya pasado por montaje.
          </p>
          <p>
            Prioridad: <strong>-</strong> normal, <strong>ALTA</strong> para
            urgentes definidos por líder de producción.
          </p>
        </CardBody>
      </Card>

      {loading ? (
        <Card
          className="border border-dashed border-divider"
          radius="md"
          shadow="none"
        >
          <CardBody className="py-12 flex items-center justify-center">
            <div className="text-center text-default-400">
              <MdSchedule className="mx-auto mb-2 animate-spin" size={36} />
              <p className="text-sm">Cargando cola de producción...</p>
            </div>
          </CardBody>
        </Card>
      ) : timedOrders.length === 0 ? (
        <Card
          className="border border-dashed border-divider"
          radius="md"
          shadow="none"
        >
          <CardBody className="py-12 flex items-center justify-center">
            <div className="text-center text-default-400">
              <MdError className="mx-auto mb-2 opacity-40" size={36} />
              <p className="text-sm">No hay pedidos en la cola de producción</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="rounded-medium border border-default-200 overflow-x-auto">
          <Table removeWrapper aria-label="Workflow de producción por pedido">
            <TableHeader>
              <TableColumn>Orden</TableColumn>
              <TableColumn>Pedido</TableColumn>
              <TableColumn>Tipo entrega</TableColumn>
              <TableColumn>Creación</TableColumn>
              <TableColumn>Cantidad total</TableColumn>
              <TableColumn>F. Entrega</TableColumn>
              <TableColumn>Horas plan</TableColumn>
              <TableColumn>Horas restantes</TableColumn>
              <TableColumn>OK Contabilidad</TableColumn>
              <TableColumn>OK Líder prod.</TableColumn>
              <TableColumn>Líder producción</TableColumn>
              <TableColumn>Prioridad</TableColumn>
              <TableColumn>Acciones</TableColumn>
            </TableHeader>
            <TableBody items={timedOrders}>
              {(item) => (
                <TableRow key={item.orderCode}>
                  <TableCell>
                    <span className="text-sm font-mono font-semibold text-default-600">
                      #{item.finalOrder}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium">{item.orderCode}</p>
                      <p className="text-xs text-default-400">
                        {item.clientName ?? "-"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip color="primary" size="sm" variant="flat">
                      {item.deliveryType}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs">{formatDate(item.orderCreatedAt)}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-medium">{item.totalQuantity}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs">{formatDate(item.deliveryDateEffective)}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs">{toHourLabel(item.totalHours)}</p>
                  </TableCell>
                  <TableCell>
                    <Chip
                      color={
                        (item.remainingHours ?? 0) <= 0
                          ? "danger"
                          : (item.remainingHours ?? 0) <= 24
                            ? "warning"
                            : "success"
                      }
                      size="sm"
                      variant="flat"
                    >
                      {toHourLabel(item.remainingHours)}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip color={item.accountingOk ? "success" : "default"} size="sm" variant="flat">
                      {item.accountingOk ? "OK" : "-"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip color={item.productionLeaderOk ? "success" : "default"} size="sm" variant="flat">
                      {item.productionLeaderOk ? "OK" : "-"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs">{item.productionLeader}</p>
                  </TableCell>
                  <TableCell>
                    <Chip color={item.isHighPriority ? "danger" : "default"} size="sm" variant="flat">
                      {item.isHighPriority ? "ALTA" : "-"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    {!item.isHighPriority ? (
                      <Button
                        color="danger"
                        isDisabled={Boolean(settingUrgent)}
                        size="sm"
                        variant="flat"
                        onPress={() => void markUrgent(item)}
                      >
                        {settingUrgent === item.orderCode
                          ? "..."
                          : "Marcar ALTA"}
                      </Button>
                    ) : (
                      <Chip color="danger" size="sm" variant="flat">
                        ALTA ↑
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
