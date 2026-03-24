"use client";

import { useEffect, useMemo, useState } from "react";
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

import { apiJson, getErrorMessage } from "@/app/erp/orders/_lib/api";
import { useSessionStore } from "@/store/session";
import {
  ORDER_ITEM_STATUS,
  type OrderItemStatus,
} from "@/src/utils/order-status";
import { getAllowedNextStatuses } from "@/src/utils/role-status";

const statusOptions: OrderItemStatus[] = [
  ORDER_ITEM_STATUS.PENDIENTE,
  ORDER_ITEM_STATUS.APROBACION,
  ORDER_ITEM_STATUS.PENDIENTE_PRODUCCION,
  ORDER_ITEM_STATUS.APROBACION_ACTUALIZACION,
  ORDER_ITEM_STATUS.PENDIENTE_PRODUCCION_ACTUALIZACION,
  ORDER_ITEM_STATUS.MONTAJE,
  ORDER_ITEM_STATUS.IMPRESION,
  ORDER_ITEM_STATUS.SUBLIMACION,
  ORDER_ITEM_STATUS.CORTE_MANUAL,
  ORDER_ITEM_STATUS.CORTE_LASER,
  ORDER_ITEM_STATUS.PENDIENTE_CONFECCION,
  ORDER_ITEM_STATUS.CONFECCION,
  ORDER_ITEM_STATUS.EN_BODEGA,
  ORDER_ITEM_STATUS.EMPAQUE,
  ORDER_ITEM_STATUS.ENVIADO,
  ORDER_ITEM_STATUS.APROBADO_CAMBIO,
  ORDER_ITEM_STATUS.RECHAZADO_CAMBIO,
  ORDER_ITEM_STATUS.COMPLETADO,
  ORDER_ITEM_STATUS.CANCELADO,
];

function formatItemStatusLabel(status: string | null | undefined) {
  const value = String(status ?? "").trim();

  if (!value) return "-";
  if (value === ORDER_ITEM_STATUS.APROBACION_ACTUALIZACION) {
    return "APROBACION ACTUALIZACION";
  }
  if (value === ORDER_ITEM_STATUS.PENDIENTE_PRODUCCION_ACTUALIZACION) {
    return "PROGRAMACION ACTUALIZACION";
  }

  return value.replace(/_/g, " ");
}

export type OrderItemStatusTarget = {
  id: string;
  name: string | null;
  quantity: number;
  status: OrderItemStatus | null;
};

export function OrderItemStatusModal({
  orderItem,
  canChangeStatus,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  orderItem: OrderItemStatusTarget | null;
  canChangeStatus: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<OrderItemStatus>("PENDIENTE");
  const [saving, setSaving] = useState(false);
  const role = useSessionStore((s) => s.user?.role ?? null);

  const allowedNext = useMemo(() => {
    const current = (orderItem?.status ?? "") as string;
    const next = getAllowedNextStatuses(role, current);

    return next.length ? next : current ? [current] : [];
  }, [orderItem?.status, role]);

  useEffect(() => {
    if (!isOpen) return;
    setSaving(false);
    setStatus((orderItem?.status ?? "PENDIENTE") as OrderItemStatus);
  }, [isOpen, orderItem]);

  const submit = async () => {
    if (!orderItem) return;
    if (!canChangeStatus) return;
    if (saving) return;

    if (orderItem.status === status) {
      onOpenChange(false);

      return;
    }

    try {
      setSaving(true);
      await apiJson(`/api/orders/items/${orderItem.id}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
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
        <ModalHeader>Estado del Diseño</ModalHeader>
        <ModalBody>
          <div className="text-sm text-default-600">
            <div>
              <span className="font-medium">Diseño:</span>{" "}
              {orderItem?.name ?? "-"}
            </div>
            <div>
              <span className="font-medium">Cantidad:</span>{" "}
              {orderItem?.quantity ?? "-"}
            </div>
            <div>
              <span className="font-medium">Estado actual:</span>{" "}
              {formatItemStatusLabel(orderItem?.status)}
            </div>
          </div>

          <Select
            isDisabled={!canChangeStatus}
            label="Estado"
            selectedKeys={[status]}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0] as OrderItemStatus | undefined;

              setStatus(first ?? "PENDIENTE");
            }}
          >
            {statusOptions
              .filter((opt) => allowedNext.includes(opt))
              .map((opt) => (
                <SelectItem key={opt}>{formatItemStatusLabel(opt)}</SelectItem>
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
