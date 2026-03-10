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
import {
  BsBoxSeam,
  BsHash,
  BsGrid,
  BsRulers,
  BsTag,
  BsTextParagraph,
  BsTruck,
} from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createInventoryItemSchema } from "../../_lib/schemas";

type SupplierRow = { id: string; name: string; isActive?: boolean | null };

const CATEGORY_OPTIONS = [
  { id: "INSUMOS_PRODUCCION", name: "Insumos de produccion" },
  { id: "PAPELERIA", name: "Papeleria" },
  { id: "ASEO", name: "Aseo" },
  { id: "REPUESTOS", name: "Repuestos" },
  { id: "REVENTA", name: "Reventa" },
] as const;
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
  const [categoryType, setCategoryType] = useState<
    "INSUMOS_PRODUCCION" | "PAPELERIA" | "ASEO" | "REPUESTOS" | "REVENTA"
  >("INSUMOS_PRODUCCION");
  const [hasVariants, setHasVariants] = useState(false);
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
    setCategoryType(item?.categoryType ?? "INSUMOS_PRODUCCION");
    setHasVariants(Boolean(item?.hasVariants));
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
      categoryType,
      hasVariants,
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
            startContent={<BsBoxSeam className="text-default-400" />}
            value={name}
            onValueChange={setName}
          />
          <Select
            errorMessage={error ?? undefined}
            isInvalid={Boolean(error)}
            label="Categoria"
            startContent={<BsGrid className="text-default-400" />}
            selectedKeys={new Set([categoryType])}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              const value = String(first ?? "INSUMOS_PRODUCCION").trim().toUpperCase();

              if (
                value === "PAPELERIA" ||
                value === "ASEO" ||
                value === "REPUESTOS" ||
                value === "REVENTA"
              ) {
                setCategoryType(value);
                return;
              }

              setCategoryType("INSUMOS_PRODUCCION");
            }}
            items={CATEGORY_OPTIONS}
          >
            {(category) => (
              <SelectItem key={category.id} textValue={category.name}>
                {category.name}
              </SelectItem>
            )}
          </Select>

          <Select
            errorMessage={error ?? undefined}
            isInvalid={Boolean(error)}
            label="Unidad de medida"
            startContent={<BsRulers className="text-default-400" />}
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
            startContent={<BsTextParagraph className="text-default-400" />}
            value={description}
            onValueChange={setDescription}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Precio (opcional)"
              startContent={<BsTag className="text-default-400" />}
              type="number"
              value={price}
              onValueChange={setPrice}
            />
            <Input
              label="Stock mínimo (opcional)"
              startContent={<BsHash className="text-default-400" />}
              type="number"
              value={minStock}
              onValueChange={setMinStock}
            />
          </div>

          <Select
            isDisabled={submitting || loadingSuppliers}
            isLoading={loadingSuppliers}
            label="Proveedor (opcional)"
            startContent={<BsTruck className="text-default-400" />}
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

          <Switch isSelected={hasVariants} onValueChange={setHasVariants}>
            Maneja variantes (color/talla)
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
