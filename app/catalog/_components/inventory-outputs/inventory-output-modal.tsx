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

const LOCATION_OPTIONS = [
  { id: "BODEGA_PRINCIPAL", name: "Bodega principal" },
  { id: "TIENDA", name: "Tienda" },
] as const;

export function InventoryOutputModal({
  output,
  items,
  itemsLoading,
  isOpen,
  onOpenChange,
  onSaved,
}: {
  output: InventoryOutput | null;
  items: InventoryItem[];
  itemsLoading: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [orderItemId, setOrderItemId] = useState("");
  const [orderItems, setOrderItems] = useState<
    Array<{ id: string; orderCode: string | null; name: string | null; status: string | null }>
  >([]);
  const [orderItemsLoading, setOrderItemsLoading] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [location, setLocation] = useState<"BODEGA_PRINCIPAL" | "TIENDA">(
    "BODEGA_PRINCIPAL",
  );
  const [reason, setReason] = useState("");
  const [available, setAvailable] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const itemOptions = items;

  useEffect(() => {
    if (!isOpen) return;
    setSubmitting(false);
    setError(null);
    setInventoryItemId(output?.inventoryItemId ?? "");
    setOrderItemId(output?.orderItemId ?? "");
    setLocation(output?.location ?? "BODEGA_PRINCIPAL");
    setQuantity(output?.quantity ? String(output.quantity) : "");
    setReason(output?.reason ?? "");
  }, [output, isOpen]);

  useEffect(() => {
    let active = true;

    if (!isOpen) return;

    setOrderItemsLoading(true);
    apiJson<{ items: Array<{ id: string; orderCode: string | null; name: string | null; status: string | null }> }>(
      `/api/order-items/options?pageSize=200`,
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

    if (!id) {
      setAvailable(null);
      return;
    }

    apiJson<{ stock: number }>(
      `/api/inventory-stock?inventoryItemId=${id}&location=${location}`,
    )
      .then((res) => {
        const base = res.stock ?? 0;
        const current =
          output?.inventoryItemId === id &&
          output?.location === location &&
          output?.quantity
            ? Number(output.quantity)
            : 0;

        setAvailable(base + (Number.isFinite(current) ? current : 0));
      })
      .catch(() => setAvailable(null));
  }, [
    inventoryItemId,
    location,
    output?.inventoryItemId,
    output?.location,
    output?.quantity,
  ]);

  const submit = async () => {
    if (submitting) return;

    const parsed = createInventoryOutputSchema.safeParse({
      inventoryItemId,
      orderItemId: orderItemId || undefined,
      location,
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
            isDisabled={submitting || itemsLoading}
            isLoading={itemsLoading}
            label="Item"
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
            type="number"
            value={quantity}
            onValueChange={setQuantity}
          />

          <Select
            isDisabled={submitting}
            label="Ubicación"
            selectedKeys={new Set([location])}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              const value = String(first ?? "").trim().toUpperCase();

              if (value === "TIENDA") {
                setLocation("TIENDA");
                return;
              }

              setLocation("BODEGA_PRINCIPAL");
            }}
            items={LOCATION_OPTIONS}
          >
            {(loc) => (
              <SelectItem key={loc.id} textValue={loc.name}>
                {loc.name}
              </SelectItem>
            )}
          </Select>

          <Textarea
            errorMessage={error ?? undefined}
            isInvalid={Boolean(error)}
            label="Motivo"
            minRows={2}
            value={reason}
            onValueChange={setReason}
          />

          <Select
            isDisabled={submitting || orderItemsLoading}
            isLoading={orderItemsLoading}
            label="Diseño (opcional)"
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
                textValue={`${it.orderCode ?? "-"} - ${it.name ?? "(sin nombre)"}`}
              >
                {it.orderCode ?? "-"} - {it.name ?? "(sin nombre)"}
              </SelectItem>
            )}
          </Select>

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
