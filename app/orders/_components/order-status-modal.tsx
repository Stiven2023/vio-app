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

const statusOptions: Array<{ value: OrderStatus; label: string }> = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "PRODUCCION", label: "Produccion" },
  { value: "ATRASADO", label: "Atrasado" },
  { value: "FINALIZADO", label: "Finalizado" },
  { value: "ENTREGADO", label: "Entregado" },
  { value: "CANCELADO", label: "Cancelado" },
  { value: "REVISION", label: "Revision" },
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
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Estado del pedido</ModalHeader>
        <ModalBody>
          <div className="text-sm text-default-600">
            <div>
              <span className="font-medium">Codigo:</span> {order?.orderCode ?? "-"}
            </div>
            <div>
              <span className="font-medium">Cliente:</span> {order?.clientName ?? "-"}
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
            {statusOptions.map((opt) => (
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
            isDisabled={!canChangeStatus}
            isLoading={saving}
            onPress={submit}
          >
            Guardar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
