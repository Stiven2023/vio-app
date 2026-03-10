"use client";

import type { InventoryEntry, InventoryItem } from "../../_lib/types";

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
import { BsBoxSeam, BsGeoAlt, BsHash, BsTruck } from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createInventoryEntrySchema } from "../../_lib/schemas";

type SupplierRow = { id: string; name: string };
type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  isActive?: boolean | null;
};
type VariantRow = {
  id: string;
  sku: string;
  color: string | null;
  size: string | null;
  isActive?: boolean | null;
};

export function InventoryEntryModal({
  entry,
  items,
  itemsLoading,
  suppliers,
  suppliersLoading,
  warehouses,
  warehousesLoading,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  entry: InventoryEntry | null;
  items: InventoryItem[];
  itemsLoading: boolean;
  suppliers: SupplierRow[];
  suppliersLoading: boolean;
  warehouses: WarehouseRow[];
  warehousesLoading: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const itemOptions = items;
  const selectedItem =
    itemOptions.find((item) => item.id === inventoryItemId) ?? null;
  const variantRequired =
    selectedItem?.hasVariants === true && variants.length > 0;
  const supplierOptions = [
    { id: "__none", name: "Sin proveedor" },
    ...suppliers,
  ];

  useEffect(() => {
    if (!isOpen) return;
    setSubmitting(false);
    setError(null);
    setInventoryItemId(entry?.inventoryItemId ?? "");
    setVariantId(entry?.variantId ?? "");
    setSupplierId(entry?.supplierId ?? "");
    setWarehouseId(entry?.warehouseId ?? "");
    setQuantity(entry?.quantity ? String(entry.quantity) : "");
  }, [entry, isOpen]);

  useEffect(() => {
    const id = String(inventoryItemId ?? "").trim();

    if (!id || !isOpen) {
      setVariants([]);
      setVariantId("");

      return;
    }

    let active = true;

    setLoadingVariants(true);
    apiJson<{ items: VariantRow[] }>(
      `/api/inventory-item-variants?inventoryItemId=${id}&page=1&pageSize=200`,
    )
      .then((res) => {
        if (!active) return;
        const rows = (res.items ?? []).filter((v) => v.isActive !== false);

        setVariants(rows);
        if (rows.length === 0) setVariantId("");
      })
      .catch(() => {
        if (!active) return;
        setVariants([]);
        setVariantId("");
      })
      .finally(() => {
        if (active) setLoadingVariants(false);
      });

    return () => {
      active = false;
    };
  }, [inventoryItemId, isOpen]);

  const submit = async () => {
    if (submitting) return;

    if (variantRequired && !variantId) {
      setError("Este item requiere seleccionar una variante");

      return;
    }

    const parsed = createInventoryEntrySchema.safeParse({
      inventoryItemId,
      variantId: variantId || undefined,
      supplierId: supplierId || undefined,
      warehouseId,
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
        body: JSON.stringify(
          entry ? { id: entry.id, ...parsed.data } : parsed.data,
        ),
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
        <ModalHeader>
          {entry ? "Editar entrada" : "Registrar entrada"}
        </ModalHeader>
        <ModalBody>
          <Select
            isDisabled={submitting || itemsLoading}
            isLoading={itemsLoading}
            items={itemOptions}
            label="Item"
            selectedKeys={
              inventoryItemId ? new Set([inventoryItemId]) : new Set([])
            }
            startContent={<BsBoxSeam className="text-default-400" />}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              setInventoryItemId(first ? String(first) : "");
            }}
          >
            {(it) => (
              <SelectItem key={it.id} textValue={it.name}>
                {it.name}
              </SelectItem>
            )}
          </Select>

          <Select
            isDisabled={submitting || warehousesLoading}
            isLoading={warehousesLoading}
            items={warehouses.filter((w) => w.isActive !== false)}
            label="Bodega"
            selectedKeys={warehouseId ? new Set([warehouseId]) : new Set([])}
            startContent={<BsGeoAlt className="text-default-400" />}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              setWarehouseId(first ? String(first) : "");
            }}
          >
            {(w) => (
              <SelectItem key={w.id} textValue={`${w.code} ${w.name}`}>
                {w.code} - {w.name}
              </SelectItem>
            )}
          </Select>

          <Select
            isDisabled={submitting || loadingVariants || variants.length === 0}
            isLoading={loadingVariants}
            isRequired={variantRequired}
            items={variants}
            label={variantRequired ? "Variante" : "Variante (opcional)"}
            selectedKeys={variantId ? new Set([variantId]) : new Set([])}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              setVariantId(first ? String(first) : "");
            }}
          >
            {(variant) => (
              <SelectItem
                key={variant.id}
                textValue={`${variant.sku} ${variant.color ?? ""} ${variant.size ?? ""}`}
              >
                {variant.sku} {variant.color ? `- ${variant.color}` : ""}{" "}
                {variant.size ? `- ${variant.size}` : ""}
              </SelectItem>
            )}
          </Select>

          <Select
            isDisabled={submitting || suppliersLoading}
            isLoading={suppliersLoading}
            items={supplierOptions}
            label="Proveedor (opcional)"
            selectedKeys={supplierId ? new Set([supplierId]) : new Set([])}
            startContent={<BsTruck className="text-default-400" />}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];

              setSupplierId(
                first === "__none" ? "" : first ? String(first) : "",
              );
            }}
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
            startContent={<BsHash className="text-default-400" />}
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
