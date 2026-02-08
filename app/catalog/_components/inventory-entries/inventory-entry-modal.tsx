"use client";

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
import { Select, SelectItem } from "@heroui/select";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createInventoryEntrySchema } from "../../_lib/schemas";

import type { InventoryEntry, InventoryItem } from "../../_lib/types";

type SupplierRow = { id: string; name: string };

export function InventoryEntryModal({
  entry,
  items,
  suppliers,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  entry: InventoryEntry | null;
  items: InventoryItem[];
  suppliers: SupplierRow[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const supplierOptions = [
    { id: "__none", name: "Sin proveedor" },
    ...suppliers,
  ];

  useEffect(() => {
    if (!isOpen) return;
    setSubmitting(false);
    setError(null);
    setInventoryItemId(entry?.inventoryItemId ?? "");
    setSupplierId(entry?.supplierId ?? "");
    setQuantity(entry?.quantity ? String(entry.quantity) : "");
  }, [entry, isOpen]);

  const submit = async () => {
    if (submitting) return;

    const parsed = createInventoryEntrySchema.safeParse({
      inventoryItemId,
      supplierId: supplierId || undefined,
      quantity,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");

      return;
    }

    setError(null);

    try {
      setSubmitting(true);
      await apiJson(`/api/inventory-entries`, {
        method: entry ? "PUT" : "POST",
        body: JSON.stringify(entry ? { id: entry.id, ...parsed.data } : parsed.data),
      });
      toast.success(entry ? "Entrada actualizada" : "Entrada creada");
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
        <ModalHeader>{entry ? "Editar entrada" : "Registrar entrada"}</ModalHeader>
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

          <Select
            isDisabled={submitting}
            label="Proveedor (opcional)"
            selectedKeys={supplierId ? [supplierId] : []}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setSupplierId(first === "__none" ? "" : first ? String(first) : "");
            }}
            items={supplierOptions}
          >
            {(s) => (
              <SelectItem key={s.id} textValue={s.name}>
                {s.name}
              </SelectItem>
            )}
          </Select>

          <Input
            errorMessage={error ?? undefined}
            isInvalid={Boolean(error)}
            label="Cantidad"
            type="number"
            value={quantity}
            onValueChange={setQuantity}
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
            {entry ? "Guardar" : "Registrar"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
