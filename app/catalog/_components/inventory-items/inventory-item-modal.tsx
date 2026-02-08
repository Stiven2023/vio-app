"use client";

import type { InventoryItem } from "../../_lib/types";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createInventoryItemSchema } from "../../_lib/schemas";

export function InventoryItemModal({
  item,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  item: InventoryItem | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSubmitting(false);
    setError(null);
    setName(item?.name ?? "");
    setUnit(item?.unit ?? "");
  }, [item, isOpen]);

  const submit = async () => {
    if (submitting) return;

    const parsed = createInventoryItemSchema.safeParse({ name, unit });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");

      return;
    }

    setError(null);

    try {
      setSubmitting(true);
      await apiJson(`/api/inventory-items`, {
        method: item ? "PUT" : "POST",
        body: JSON.stringify(item ? { id: item.id, ...parsed.data } : parsed.data),
      });
      toast.success(item ? "Item actualizado" : "Item creado");
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
        <ModalHeader>{item ? "Editar item" : "Crear item"}</ModalHeader>
        <ModalBody>
          <Input
            errorMessage={error ?? undefined}
            isInvalid={Boolean(error)}
            label="Nombre"
            value={name}
            onValueChange={setName}
          />
          <Input
            errorMessage={error ?? undefined}
            isInvalid={Boolean(error)}
            label="Unidad"
            value={unit}
            onValueChange={setUnit}
          />
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
            {item ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
