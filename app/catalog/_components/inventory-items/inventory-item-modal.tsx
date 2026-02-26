"use client";

import type { InventoryItem } from "../../_lib/types";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createInventoryItemSchema } from "../../_lib/schemas";

type SupplierRow = { id: string; name: string; isActive?: boolean | null };
type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

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
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [minStock, setMinStock] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSubmitting(false);
    setError(null);
    setName(item?.name ?? "");
    setUnit(item?.unit ?? "");
    setDescription(item?.description ?? "");
    setPrice(item?.price ?? "");
    setSupplierId(item?.supplierId ?? "");
    setMinStock(item?.minStock ?? "");
    setIsActive(item?.isActive ?? true);
  }, [item, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setLoadingSuppliers(true);
    apiJson<Paginated<SupplierRow>>(`/api/suppliers?page=1&pageSize=600`)
      .then((res) => {
        if (!active) return;
        setSuppliers(res.items ?? []);
      })
      .catch(() => {
        if (!active) return;
        setSuppliers([]);
      })
      .finally(() => {
        if (active) setLoadingSuppliers(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  const submit = async () => {
    if (submitting) return;

    const parsed = createInventoryItemSchema.safeParse({
      name,
      unit,
      description,
      price,
      supplierId: supplierId ? supplierId : undefined,
      minStock,
      isActive,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");

      return;
    }

    setError(null);

    try {
      setSubmitting(true);
      await apiJson(`/api/inventory-items`, {
        method: item ? "PUT" : "POST",
        body: JSON.stringify(
          item ? { id: item.id, ...parsed.data } : parsed.data,
        ),
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
          <Select
            errorMessage={error ?? undefined}
            isInvalid={Boolean(error)}
            label="Unidad de medida"
            selectedKeys={unit ? [String(unit)] : []}
            onSelectionChange={(keys: any) => {
              const k = Array.from(keys as any)[0];
              setUnit(k ? String(k) : "");
            }}
          >
            <SelectItem key="unidades">Unidades</SelectItem>
            <SelectItem key="metros">Metros</SelectItem>
            <SelectItem key="talla">Talla</SelectItem>

            {unit &&
            ![
              "unidades",
              "metros",
              "talla",
            ].includes(unit) ? (
              <SelectItem key={unit}>{unit}</SelectItem>
            ) : null}
          </Select>

          <Input
            label="Descripción (opcional)"
            value={description}
            onValueChange={setDescription}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Precio (opcional)"
              type="number"
              value={price}
              onValueChange={setPrice}
            />
            <Input
              label="Stock mínimo (opcional)"
              type="number"
              value={minStock}
              onValueChange={setMinStock}
            />
          </div>

          <Select
            isDisabled={submitting || loadingSuppliers}
            isLoading={loadingSuppliers}
            label="Proveedor (opcional)"
            selectedKeys={supplierId ? new Set([supplierId]) : new Set([])}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setSupplierId(first === "__none" ? "" : first ? String(first) : "");
            }}
            items={[{ id: "__none", name: "Sin proveedor" }, ...suppliers]}
          >
            {(s) => (
              <SelectItem key={s.id} textValue={s.name}>
                {s.name}
              </SelectItem>
            )}
          </Select>

          <Switch isSelected={isActive} onValueChange={setIsActive}>
            Activo
          </Switch>
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
