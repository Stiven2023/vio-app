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

import { apiJson, getErrorMessage } from "@/app/orders/_lib/api";
import { useSessionStore } from "@/store/session";
import { getAllowedNextStatuses } from "@/src/utils/role-status";

type OrderItemStatus =
  | "PENDIENTE"
  | "REVISION_ADMIN"
  | "APROBACION_INICIAL"
  | "PENDIENTE_PRODUCCION"
  | "EN_MONTAJE"
  | "EN_IMPRESION"
  | "SUBLIMACION"
  | "CORTE_MANUAL"
  | "CORTE_LASER"
  | "PENDIENTE_CONFECCION"
  | "CONFECCION"
  | "EN_BODEGA"
  | "EMPAQUE"
  | "ENVIADO"
  | "EN_REVISION_CAMBIO"
  | "APROBADO_CAMBIO"
  | "RECHAZADO_CAMBIO"
  | "COMPLETADO"
  | "CANCELADO";

const statusOptions: OrderItemStatus[] = [
  "PENDIENTE",
  "REVISION_ADMIN",
  "APROBACION_INICIAL",
  "PENDIENTE_PRODUCCION",
  "EN_MONTAJE",
  "EN_IMPRESION",
  "SUBLIMACION",
  "CORTE_MANUAL",
  "CORTE_LASER",
  "PENDIENTE_CONFECCION",
  "CONFECCION",
  "EN_BODEGA",
  "EMPAQUE",
  "ENVIADO",
  "EN_REVISION_CAMBIO",
  "APROBADO_CAMBIO",
  "RECHAZADO_CAMBIO",
  "COMPLETADO",
  "CANCELADO",
];

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
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Estado del Diseño</ModalHeader>
        <ModalBody>
          <div className="text-sm text-default-600">
            <div>
              <span className="font-medium">Diseño:</span> {orderItem?.name ?? "-"}
            </div>
            <div>
              <span className="font-medium">Cantidad:</span> {orderItem?.quantity ?? "-"}
            </div>
            <div>
              <span className="font-medium">Estado actual:</span> {orderItem?.status ?? "-"}
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
              <SelectItem key={opt}>{opt.replace(/_/g, " ")}</SelectItem>
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
