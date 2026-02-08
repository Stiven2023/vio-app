"use client";

import type { InventoryItem, InventoryOutput } from "../../_lib/types";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createInventoryOutputSchema } from "../../_lib/schemas";

export function InventoryOutputModal({
  output,
  items,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  output: InventoryOutput | null;
  items: InventoryItem[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [orderItemId, setOrderItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [available, setAvailable] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSubmitting(false);
    setError(null);
    setInventoryItemId(output?.inventoryItemId ?? "");
    setOrderItemId(output?.orderItemId ?? "");
    setQuantity(output?.quantity ? String(output.quantity) : "");
    setReason(output?.reason ?? "");
  }, [output, isOpen]);

  useEffect(() => {
    const id = String(inventoryItemId ?? "").trim();

    if (!id) {
      setAvailable(null);
      return;
    }

    apiJson<{ stock: number }>(`/api/inventory-stock?inventoryItemId=${id}`)
      .then((res) => {
        const base = res.stock ?? 0;
        const current =
          output?.inventoryItemId === id && output?.quantity
            ? Number(output.quantity)
            : 0;

        setAvailable(base + (Number.isFinite(current) ? current : 0));
      })
      .catch(() => setAvailable(null));
  }, [inventoryItemId, output?.inventoryItemId, output?.quantity]);

  const submit = async () => {
    if (submitting) return;

    const parsed = createInventoryOutputSchema.safeParse({
      inventoryItemId,
      orderItemId: orderItemId || undefined,
      quantity,
      reason,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");

      return;
    }

    setError(null);

    try {
      setSubmitting(true);
      await apiJson(`/api/inventory-outputs`, {
        method: output ? "PUT" : "POST",
        body: JSON.stringify(output ? { id: output.id, ...parsed.data } : parsed.data),
      });
      toast.success(output ? "Salida actualizada" : "Salida creada");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>{output ? "Editar salida" : "Registrar salida"}</ModalHeader>
        <ModalBody>
          <Select
            isDisabled={submitting}
            label="Item"
            selectedKeys={inventoryItemId ? [inventoryItemId] : []}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setInventoryItemId(first ? String(first) : "");
            }}
          >
            {items.map((it) => (
              <SelectItem key={it.id}>{it.name}</SelectItem>
            ))}
          </Select>

          <Input
            errorMessage={error ?? undefined}
            isInvalid={Boolean(error)}
            label="Cantidad"
            type="number"
            value={quantity}
            onValueChange={setQuantity}
          />

          <Textarea
            errorMessage={error ?? undefined}
            isInvalid={Boolean(error)}
            label="Motivo"
            minRows={2}
            value={reason}
            onValueChange={setReason}
          />

          <Input
            label="Order item ID (opcional)"
            value={orderItemId}
            onValueChange={setOrderItemId}
          />

          <div className="text-xs text-default-500">
            Disponible: {available === null ? "-" : available}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            isDisabled={submitting}
            variant="flat"
            onPress={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button color="primary" isLoading={submitting} onPress={submit}>
            {output ? "Guardar" : "Registrar"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
