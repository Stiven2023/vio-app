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
  BsPlus,
  BsTrash,
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

type DraftVariant = {
  id: string;
  sku: string;
  color: string;
  size: string;
  description: string;
  isActive: boolean;
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
  const [draftColor, setDraftColor] = useState("");
  const [draftSize, setDraftSize] = useState("");
  const [draftVariantDescription, setDraftVariantDescription] = useState("");
  const [draftVariantSku, setDraftVariantSku] = useState("");
  const [initialVariants, setInitialVariants] = useState<DraftVariant[]>([]);
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
    setDraftColor("");
    setDraftSize("");
    setDraftVariantDescription("");
    setDraftVariantSku("");
    setInitialVariants([]);
  }, [item, isOpen]);

  const addDraftVariant = () => {
    const sku = draftVariantSku.trim().toUpperCase();
    const color = draftColor.trim();
    const size = draftSize.trim();
    const description = draftVariantDescription.trim();

    if (!sku) {
      setError("El codigo de variante es obligatorio");
      return;
    }

    if (!color && !size) {
      setError("Para agregar variante inicial, define color o talla");
      return;
    }

    if (initialVariants.some((variant) => variant.sku.toUpperCase() === sku)) {
      setError("El codigo de variante ya fue agregado en esta lista");
      return;
    }

    setError(null);
    setInitialVariants((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        sku,
        color,
        size,
        description,
        isActive: true,
      },
    ]);

    setDraftColor("");
    setDraftSize("");
    setDraftVariantDescription("");
    setDraftVariantSku("");
  };

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
          item
            ? { id: item.id, ...parsed.data }
            : {
                ...parsed.data,
                initialVariants: hasVariants
                  ? initialVariants.map((variant) => ({
                          sku: variant.sku,
                      color: variant.color,
                      size: variant.size,
                      description: variant.description,
                      isActive: variant.isActive,
                    }))
                  : [],
              },
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

          {hasVariants && !item ? (
            <div className="space-y-2 rounded-lg border border-default-200 p-3">
              <p className="text-sm font-semibold">Variantes iniciales (opcional)</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <Input
                  label="Codigo variante"
                  value={draftVariantSku}
                  onValueChange={setDraftVariantSku}
                />
                <Input
                  label="Color"
                  value={draftColor}
                  onValueChange={setDraftColor}
                />
                <Input
                  label="Talla"
                  value={draftSize}
                  onValueChange={setDraftSize}
                />
                <Input
                  className="md:col-span-1"
                  label="Descripcion"
                  value={draftVariantDescription}
                  onValueChange={setDraftVariantDescription}
                />
              </div>
              <Button
                size="sm"
                startContent={<BsPlus />}
                variant="flat"
                onPress={addDraftVariant}
              >
                Agregar variante inicial
              </Button>

              <div className="space-y-1">
                {initialVariants.length === 0 ? (
                  <p className="text-xs text-default-500">Sin variantes iniciales.</p>
                ) : (
                  initialVariants.map((variant, index) => (
                    <div
                      key={variant.id}
                      className="flex items-center justify-between rounded-md border border-default-200 px-2 py-1"
                    >
                      <p className="text-xs">
                        {`#${index + 1}  Cod: ${variant.sku} / Color: ${variant.color || "-"} / Talla: ${variant.size || "-"}${variant.description ? ` / ${variant.description}` : ""}`}
                      </p>
                      <Button
                        isIconOnly
                        color="danger"
                        size="sm"
                        startContent={<BsTrash />}
                        variant="light"
                        onPress={() => {
                          setInitialVariants((prev) => prev.filter((v) => v.id !== variant.id));
                        }}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
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
