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
import {
  BsBoxSeam,
  BsCardText,
  BsGeoAlt,
  BsHash,
  BsPersonBadge,
} from "react-icons/bs";

import { apiJson, getErrorMessage } from "../../_lib/api";
import { createInventoryOutputSchema } from "../../_lib/schemas";

type WarehouseRow = { id: string; code: string; name: string; isActive?: boolean | null };
type VariantRow = { id: string; sku: string; color: string | null; size: string | null; isActive?: boolean | null };

export function InventoryOutputModal({
  output,
  items,
  itemsLoading,
  warehouses,
  warehousesLoading,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  output: InventoryOutput | null;
  items: InventoryItem[];
  itemsLoading: boolean;
  warehouses: WarehouseRow[];
  warehousesLoading: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [orderItemId, setOrderItemId] = useState("");
  const [orderItems, setOrderItems] = useState<
    Array<{
      id: string;
      orderCode: string | null;
      name: string | null;
      status: string | null;
      requesterEmployeeName: string | null;
    }>
  >([]);
  const [orderItemsLoading, setOrderItemsLoading] = useState(false);
  const [variantId, setVariantId] = useState("");
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [reason, setReason] = useState("");
  const [available, setAvailable] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const itemOptions = items;
  const selectedItem = itemOptions.find((item) => item.id === inventoryItemId) ?? null;
  const variantRequired = selectedItem?.hasVariants === true && variants.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    setSubmitting(false);
    setError(null);
    setInventoryItemId(output?.inventoryItemId ?? "");
    setVariantId(output?.variantId ?? "");
    setOrderItemId(output?.orderItemId ?? "");
    setWarehouseId(output?.warehouseId ?? "");
    setQuantity(output?.quantity ? String(output.quantity) : "");
    setReason(output?.reason ?? "");
  }, [output, isOpen]);

  useEffect(() => {
    let active = true;

    if (!isOpen) return;

    setOrderItemsLoading(true);
    apiJson<{
      items: Array<{
        id: string;
        orderCode: string | null;
        name: string | null;
        status: string | null;
        requesterEmployeeName: string | null;
      }>;
    }>(
      `/api/inventory-outputs/order-items-options?pageSize=200`,
    )
      .then((res) => {
        if (!active) return;
        setOrderItems(Array.isArray(res.items) ? res.items : []);
      })
      .catch(() => {
        if (!active) return;
        setOrderItems([]);
      })
      .finally(() => {
        if (active) setOrderItemsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    const id = String(inventoryItemId ?? "").trim();
    if (!id || !isOpen) {
      setVariants([]);
      setVariantId("");
      return;
    }

    let active = true;
    setLoadingVariants(true);
    apiJson<{ items: VariantRow[] }>(`/api/inventory-item-variants?inventoryItemId=${id}&page=1&pageSize=200`)
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

  useEffect(() => {
    const id = String(inventoryItemId ?? "").trim();

    if (!id) {
      setAvailable(null);
      return;
    }

    if (!warehouseId) {
      setAvailable(null);
      return;
    }

    apiJson<{ stock: number }>(
      variantId
        ? `/api/inventory-stock?variantId=${variantId}&warehouseId=${warehouseId}`
        : `/api/inventory-stock?inventoryItemId=${id}&warehouseId=${warehouseId}`,
    )
      .then((res) => {
        const base = res.stock ?? 0;
        const current =
          output?.inventoryItemId === id &&
          output?.warehouseId === warehouseId &&
          (output?.variantId ?? "") === variantId &&
          output?.quantity
            ? Number(output.quantity)
            : 0;

        setAvailable(base + (Number.isFinite(current) ? current : 0));
      })
      .catch(() => setAvailable(null));
  }, [
    inventoryItemId,
    variantId,
    warehouseId,
    output?.inventoryItemId,
    output?.variantId,
    output?.warehouseId,
    output?.quantity,
  ]);

  const submit = async () => {
    if (submitting) return;

    if (variantRequired && !variantId) {
      setError("Este item requiere seleccionar una variante");
      return;
    }

    const parsed = createInventoryOutputSchema.safeParse({
      inventoryItemId,
      variantId: variantId || undefined,
      orderItemId: orderItemId || undefined,
      warehouseId,
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

  const selectedOrderItem =
    orderItems.find((orderItem) => orderItem.id === orderItemId) ?? null;

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>{output ? "Editar salida" : "Registrar salida"}</ModalHeader>
        <ModalBody>
          <Select
            isDisabled={submitting || itemsLoading}
            isLoading={itemsLoading}
            label="Item"
            startContent={<BsBoxSeam className="text-default-400" />}
            selectedKeys={
              inventoryItemId ? new Set([inventoryItemId]) : new Set([])
            }
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setInventoryItemId(first ? String(first) : "");
            }}
            items={itemOptions}
          >
            {(it) => (
              <SelectItem key={it.id} textValue={it.name}>
                {it.name}
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

          <Select
            isDisabled={submitting || loadingVariants || variants.length === 0}
            isLoading={loadingVariants}
            isRequired={variantRequired}
            label={variantRequired ? "Variante" : "Variante (opcional)"}
            selectedKeys={variantId ? new Set([variantId]) : new Set([])}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setVariantId(first ? String(first) : "");
            }}
            items={variants}
          >
            {(variant) => (
              <SelectItem key={variant.id} textValue={`${variant.sku} ${variant.color ?? ""} ${variant.size ?? ""}`}>
                {variant.sku} {variant.color ? `- ${variant.color}` : ""} {variant.size ? `- ${variant.size}` : ""}
              </SelectItem>
            )}
          </Select>

          <Select
            isDisabled={submitting || warehousesLoading}
            isLoading={warehousesLoading}
            label="Bodega"
            startContent={<BsGeoAlt className="text-default-400" />}
            selectedKeys={warehouseId ? new Set([warehouseId]) : new Set([])}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setWarehouseId(first ? String(first) : "");
            }}
            items={warehouses.filter((w) => w.isActive !== false)}
          >
            {(w) => (
              <SelectItem key={w.id} textValue={`${w.code} ${w.name}`}>
                {w.code} - {w.name}
              </SelectItem>
            )}
          </Select>

          <Textarea
            errorMessage={error ?? undefined}
            isInvalid={Boolean(error)}
            label="Motivo"
            minRows={2}
            startContent={<BsCardText className="text-default-400" />}
            value={reason}
            onValueChange={setReason}
          />

          <Select
            isDisabled={submitting || orderItemsLoading}
            isLoading={orderItemsLoading}
            label="Pedido y diseño"
            startContent={<BsCardText className="text-default-400" />}
            selectedKeys={orderItemId ? new Set([orderItemId]) : new Set([])}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setOrderItemId(first ? String(first) : "");
            }}
            items={orderItems}
          >
            {(it) => (
              <SelectItem
                key={it.id}
                textValue={`${it.orderCode ?? "-"} - ${it.name ?? "(sin nombre)"} - ${it.requesterEmployeeName ?? "Sin solicitante"}`}
              >
                {it.orderCode ?? "-"} - {it.name ?? "(sin nombre)"}
              </SelectItem>
            )}
          </Select>

          <Input
            isReadOnly
            label="Empleado solicitante"
            startContent={<BsPersonBadge className="text-default-400" />}
            value={selectedOrderItem?.requesterEmployeeName ?? ""}
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
