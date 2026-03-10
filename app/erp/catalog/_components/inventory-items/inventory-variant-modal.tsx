"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

import { apiJson, getErrorMessage } from "../../_lib/api";

type VariantRow = {
  id: string;
  inventoryItemId: string;
  sku: string;
  color: string | null;
  size: string | null;
  description: string | null;
  isActive: boolean | null;
};

export function InventoryVariantModal({
  itemId,
  variant,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  itemId: string;
  variant: VariantRow | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setColor(variant?.color ?? "");
    setSize(variant?.size ?? "");
    setDescription(variant?.description ?? "");
    setIsActive(variant?.isActive ?? true);
    setSubmitting(false);
  }, [isOpen, variant]);

  const submit = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      await apiJson("/api/inventory-item-variants", {
        method: variant ? "PUT" : "POST",
        body: JSON.stringify(
          variant
            ? { id: variant.id, color, size, description, isActive }
            : { inventoryItemId: itemId, color, size, description, isActive },
        ),
      });

      toast.success(variant ? "Variante actualizada" : "Variante creada");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>{variant ? "Editar variante" : "Crear variante"}</ModalHeader>
        <ModalBody>
          {variant?.sku ? (
            <Input isReadOnly label="SKU" value={variant.sku} />
          ) : null}
          <Input label="Color (opcional)" value={color} onValueChange={setColor} />
          <Input label="Talla (opcional)" value={size} onValueChange={setSize} />
          <Input
            label="Descripcion (opcional)"
            value={description}
            onValueChange={setDescription}
          />
          <Switch isSelected={isActive} onValueChange={setIsActive}>
            Activa
          </Switch>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button color="primary" isLoading={submitting} onPress={submit}>
            {variant ? "Guardar" : "Crear"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
