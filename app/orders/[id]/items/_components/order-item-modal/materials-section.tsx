"use client";

import type {
  OrderItemMaterialInput,
} from "@/app/orders/_lib/order-item-types";

import React from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";

type InventoryItem = {
  id: string;
  name: string;
  unit: string | null;
};

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

export function MaterialsSection({
  inventoryItems,
  value,
  disabled,
  onChange,
}: {
  inventoryItems: InventoryItem[];
  value: OrderItemMaterialInput[];
  disabled: boolean;
  onChange: (next: OrderItemMaterialInput[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Materiales (compras)</div>
        <Button
          isDisabled={disabled}
          size="sm"
          variant="flat"
          onPress={() =>
            onChange([
              ...value,
              { inventoryItemId: "", quantity: 1, note: "" },
            ])
          }
        >
          Agregar
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="text-sm text-foreground-500">Sin materiales.</div>
      ) : null}

      <div className="flex flex-col gap-3">
        {value.map((m, idx) => (
          <div key={idx} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Select
              isDisabled={disabled}
              label="Ítem"
              selectedKeys={m.inventoryItemId ? [m.inventoryItemId] : []}
              onSelectionChange={(keys: any) => {
                const k = Array.from(keys as any)[0];

                onChange(
                  value.map((x, i) =>
                    i === idx ? { ...x, inventoryItemId: k ? String(k) : "" } : x,
                  ),
                );
              }}
            >
              {inventoryItems.map((ii) => (
                <SelectItem key={ii.id} textValue={ii.name}>
                  {ii.name}
                </SelectItem>
              ))}
            </Select>

            <Input
              isDisabled={disabled}
              label="Cantidad"
              type="number"
              value={String(m.quantity ?? 1)}
              onValueChange={(v: string) =>
                onChange(
                  value.map((x, i) =>
                    i === idx ? { ...x, quantity: Math.max(0, asNumber(v)) } : x,
                  ),
                )
              }
            />

            <Input
              isDisabled={disabled}
              label="Nota"
              value={String(m.note ?? "")}
              onValueChange={(v: string) =>
                onChange(value.map((x, i) => (i === idx ? { ...x, note: v } : x)))
              }
            />

            <Button
              color="danger"
              isDisabled={disabled}
              variant="flat"
              onPress={() => onChange(value.filter((_, i) => i !== idx))}
            >
              Quitar
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
