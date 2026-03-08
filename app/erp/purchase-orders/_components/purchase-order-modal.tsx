"use client";

import { useEffect, useMemo, useState } from "react";
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

import { apiJson, getErrorMessage } from "../_lib/api";
import { createPurchaseOrderSchema } from "../_lib/schemas";

import type { InventoryItemOption, SupplierOption } from "../_lib/types";

type OptionsResponse = {
  suppliers: SupplierOption[];
  inventoryItems: InventoryItemOption[];
};

type DraftItem = { inventoryItemId: string; quantity: string };

export function PurchaseOrderModal({
  isOpen,
  onOpenChange,
  onSaved,
  canAssociateSupplier,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  canAssociateSupplier: boolean;
}) {
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemOption[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ inventoryItemId: "", quantity: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setSubmitting(false);
    setSupplierId("");
    setNotes("");
    setItems([{ inventoryItemId: "", quantity: "" }]);

    let active = true;
    setLoadingOptions(true);
    apiJson<OptionsResponse>("/api/purchase-orders/options")
      .then((res) => {
        if (!active) return;
        setSuppliers(res.suppliers ?? []);
        setInventoryItems(res.inventoryItems ?? []);
      })
      .catch(() => {
        if (!active) return;
        setSuppliers([]);
        setInventoryItems([]);
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  const supplierOptions = useMemo(
    () => [{ id: "__none", name: "Sin proveedor" }, ...suppliers],
    [suppliers],
  );

  const submit = async () => {
    if (submitting) return;

    const parsed = createPurchaseOrderSchema.safeParse({
      supplierId: supplierId ? supplierId : undefined,
      notes: notes.trim() ? notes.trim() : undefined,
      items,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }

    if (supplierId && !canAssociateSupplier) {
      setError("No tienes permiso para asociar proveedor");
      return;
    }

    setError(null);

    try {
      setSubmitting(true);
      await apiJson("/api/purchase-orders", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      toast.success("Orden creada");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
      <ModalContent>
        <ModalHeader>Nueva orden de compra</ModalHeader>
        <ModalBody className="space-y-3">
          {canAssociateSupplier ? (
            <Select
              isDisabled={submitting || loadingOptions}
              isLoading={loadingOptions}
              label="Proveedor (opcional)"
              selectedKeys={supplierId ? new Set([supplierId]) : new Set([])}
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
          ) : null}

          <Input
            label="Notas (opcional)"
            value={notes}
            onValueChange={setNotes}
            isDisabled={submitting}
          />

          <div className="space-y-2">
            <div className="text-sm font-medium">Items</div>

            {items.map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-7">
                  <Select
                    isDisabled={submitting || loadingOptions}
                    isLoading={loadingOptions}
                    label={idx === 0 ? "Item" : undefined}
                    selectedKeys={
                      row.inventoryItemId ? new Set([row.inventoryItemId]) : new Set([])
                    }
                    onSelectionChange={(keys) => {
                      const first = Array.from(keys)[0];
                      const value = first ? String(first) : "";
                      setItems((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, inventoryItemId: value } : p)),
                      );
                    }}
                    items={inventoryItems}
                  >
                    {(it) => (
                      <SelectItem key={it.id} textValue={it.name}>
                        {it.name}
                      </SelectItem>
                    )}
                  </Select>
                </div>

                <div className="sm:col-span-3">
                  <Input
                    label={idx === 0 ? "Cantidad" : undefined}
                    type="number"
                    value={row.quantity}
                    onValueChange={(v) => {
                      setItems((prev) =>
                        prev.map((p, i) => (i === idx ? { ...p, quantity: v } : p)),
                      );
                    }}
                    isDisabled={submitting}
                  />
                </div>

                <div className="sm:col-span-2 flex items-end gap-2">
                  <Button
                    variant="flat"
                    isDisabled={submitting}
                    onPress={() => {
                      setItems((prev) => [...prev, { inventoryItemId: "", quantity: "" }]);
                    }}
                  >
                    +
                  </Button>
                  <Button
                    variant="flat"
                    isDisabled={submitting || items.length === 1}
                    onPress={() => {
                      setItems((prev) => prev.filter((_, i) => i !== idx));
                    }}
                  >
                    −
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {error ? <div className="text-danger text-sm">{error}</div> : null}
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={submitting} variant="flat" onPress={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button color="primary" isLoading={submitting} onPress={submit}>
            Crear
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
