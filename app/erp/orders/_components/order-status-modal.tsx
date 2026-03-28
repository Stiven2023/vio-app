"use client";

import type { OrderListItem, OrderStatus } from "../_lib/types";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";

import { apiJson, getErrorMessage } from "../_lib/api";

import { getAllowedNextOrderStatuses } from "@/src/utils/order-workflow";

const statusOptions: Array<{ value: OrderStatus; label: string }> = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "PENDIENTE_CONTABILIDAD", label: "Pendiente contabilidad" },
  { value: "APROBADO_CONTABILIDAD", label: "Aprobado contabilidad" },
  { value: "APROBACION", label: "Aprobación" },
  { value: "PROGRAMACION", label: "Programación" },
  { value: "PRODUCCION", label: "Produccion" },
  { value: "ATRASADO", label: "Atrasado" },
  { value: "FINALIZADO", label: "Finalizado" },
  { value: "ENTREGADO", label: "Entregado" },
  { value: "CANCELADO", label: "Cancelado" },
];

export function OrderStatusModal({
  order,
  canChangeStatus,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  order: OrderListItem | null;
  canChangeStatus: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<OrderStatus>("PENDIENTE");
  const [saving, setSaving] = useState(false);

  const allowedStatuses = order
    ? [order.status, ...getAllowedNextOrderStatuses(order.status)].filter(
        (value, index, array) => array.indexOf(value) === index,
      )
    : [];

  useEffect(() => {
    if (!isOpen) return;
    setSaving(false);
    setStatus((order?.status ?? "PENDIENTE") as OrderStatus);
  }, [isOpen, order]);

  const submit = async () => {
    if (!order) return;
    if (!canChangeStatus) return;
    if (saving) return;

    if (order.status === status) {
      onOpenChange(false);

      return;
    }

    try {
      setSaving(true);
      await apiJson(`/api/orders`, {
        method: "PUT",
        body: JSON.stringify({ id: order.id, status }),
      });
      toast.success("Estado actualizado");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal disableAnimation isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Estado del pedido</ModalHeader>
        <ModalBody>
          <div className="text-sm text-default-600">
            <div>
              <span className="font-medium">Codigo:</span>{" "}
              {order?.orderCode ?? "-"}
            </div>
            <div>
              <span className="font-medium">Cliente:</span>{" "}
              {order?.clientName ?? "-"}
            </div>
            <div>
              <span className="font-medium">Tipo:</span> {order?.type ?? "-"}
            </div>
          </div>

          <Select
            isDisabled={!canChangeStatus}
            label="Estado"
            selectedKeys={[status]}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0] as OrderStatus | undefined;

              setStatus(first ?? "PENDIENTE");
            }}
          >
            {statusOptions
              .filter((opt) => allowedStatuses.includes(opt.value))
              .map((opt) => (
                <SelectItem key={opt.value}>{opt.label}</SelectItem>
              ))}
          </Select>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            color="primary"
            isDisabled={!canChangeStatus || saving}
            onPress={submit}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
