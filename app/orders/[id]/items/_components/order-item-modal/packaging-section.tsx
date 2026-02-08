"use client";

import type {
  OrderItemPackagingInput,
  PackagingMode,
} from "@/app/orders/_lib/order-item-types";

import React from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";

import {
  parseIndividualPackagingFromRows,
  readExcelFirstSheetRows,
} from "@/app/orders/_lib/excel";

function ensureGrouped(currentSize: string) {
  const next: OrderItemPackagingInput[] = [
    { mode: "AGRUPADO", size: currentSize || "", quantity: 1 },
  ];

  return next;
}

export function PackagingSection({
  mode,
  packaging,
  disabled,
  onModeChange,
  onPackagingChange,
  onError,
}: {
  mode: PackagingMode;
  packaging: OrderItemPackagingInput[];
  disabled: boolean;
  onModeChange: (next: PackagingMode) => void;
  onPackagingChange: (next: OrderItemPackagingInput[]) => void;
  onError?: (message: string) => void;
}) {
  const grouped = mode === "AGRUPADO";
  const groupedSize = grouped ? String(packaging?.[0]?.size ?? "") : "";
  const groupedQty = grouped ? Number(packaging?.[0]?.quantity ?? 1) : 0;
  const individualRows = (packaging ?? []).filter((p) => p.mode === "INDIVIDUAL");

  const groupedSummary = React.useMemo(() => {
    if (grouped) {
      return groupedSize
        ? [{ size: groupedSize, quantity: Math.max(1, groupedQty || 1) }]
        : [];
    }

    const map = new Map<string, number>();

    for (const row of individualRows) {
      const size = String(row.size ?? "").trim();
      if (!size) continue;
      const qty = Number(row.quantity ?? 1);
      const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 1;

      map.set(size, (map.get(size) ?? 0) + safeQty);
    }

    return Array.from(map.entries()).map(([size, quantity]) => ({
      size,
      quantity,
    }));
  }, [grouped, groupedQty, groupedSize, individualRows]);

  async function onImportExcel(file: File) {
    try {
      const rows = await readExcelFirstSheetRows(file);
      const parsed = parseIndividualPackagingFromRows(rows);

      const next: OrderItemPackagingInput[] = parsed.map((p) => ({
        mode: "INDIVIDUAL",
        size: p.size,
        quantity: p.quantity,
        personName: p.personName,
        personNumber: p.personNumber,
      }));

      onModeChange("INDIVIDUAL");
      onPackagingChange(next);
    } catch (e: any) {
      onError?.(e?.message ?? "No se pudo importar el Excel de empaque");
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">Empaque</div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Select
          isDisabled={disabled}
          label="Modo"
          selectedKeys={[mode]}
          onSelectionChange={(keys: any) => {
            const k = Array.from(keys as any)[0];
            const next = (String(k ?? "AGRUPADO") as PackagingMode) || "AGRUPADO";

            onModeChange(next);

            if (next === "AGRUPADO") {
              onPackagingChange(ensureGrouped(groupedSize));
            } else {
              onPackagingChange(
                (packaging ?? [])
                  .filter((p) => p.mode === "INDIVIDUAL")
                  .map((p) => ({ ...p, mode: "INDIVIDUAL" })),
              );
            }
          }}
        >
          <SelectItem key="AGRUPADO">Agrupado</SelectItem>
          <SelectItem key="INDIVIDUAL">Individual</SelectItem>
        </Select>

        {grouped ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              isDisabled={disabled}
              label="Talla (agrupado)"
              value={groupedSize}
              onValueChange={(v: string) =>
                onPackagingChange([
                  { mode: "AGRUPADO", size: v, quantity: groupedQty || 1 },
                ])
              }
            />
            <Input
              isDisabled={disabled}
              label="Cantidad"
              type="number"
              value={String(groupedQty || 1)}
              onValueChange={(v: string) => {
                const nextQty = Math.max(1, Math.floor(Number(v || 1)));
                onPackagingChange([
                  { mode: "AGRUPADO", size: groupedSize, quantity: nextQty },
                ]);
              }}
            />
          </div>
        ) : (
          <div>
            <div className="text-sm text-default-600 mb-1">Importar Excel</div>
            <input
              accept=".xlsx,.xls"
              disabled={disabled}
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0];

                if (!f) return;

                onImportExcel(f);
              }}
            />
            <div className="text-xs text-default-500 mt-1">
              Columnas esperadas: nombre, numero (opcional), talla.
            </div>
          </div>
        )}
      </div>

      {!grouped ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Lista individual</div>
            <Button
              isDisabled={disabled}
              size="sm"
              variant="flat"
              onPress={() =>
                onPackagingChange([
                  ...packaging,
                  {
                    mode: "INDIVIDUAL",
                    size: "",
                    quantity: 1,
                    personName: "",
                    personNumber: "",
                  },
                ])
              }
            >
              Agregar
            </Button>
          </div>

          {packaging.length === 0 ? (
            <div className="text-sm text-default-500">Sin registros.</div>
          ) : null}

          <div className="flex flex-col gap-3">
            {packaging.map((p, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-3 md:grid-cols-5">
                <Input
                  isDisabled={disabled}
                  label="Nombre"
                  value={String(p.personName ?? "")}
                  onValueChange={(v: string) =>
                    onPackagingChange(
                      packaging.map((x, i) =>
                        i === idx ? { ...x, personName: v } : x,
                      ),
                    )
                  }
                />
                <Input
                  isDisabled={disabled}
                  label="Numero"
                  value={String(p.personNumber ?? "")}
                  onValueChange={(v: string) =>
                    onPackagingChange(
                      packaging.map((x, i) =>
                        i === idx ? { ...x, personNumber: v } : x,
                      ),
                    )
                  }
                />
                <Input
                  isDisabled={disabled}
                  label="Talla"
                  value={String(p.size ?? "")}
                  onValueChange={(v: string) =>
                    onPackagingChange(
                      packaging.map((x, i) => (i === idx ? { ...x, size: v } : x)),
                    )
                  }
                />
                <Input
                  isDisabled={disabled}
                  label="Cantidad"
                  type="number"
                  value={String(p.quantity ?? 1)}
                  onValueChange={(v: string) =>
                    onPackagingChange(
                      packaging.map((x, i) =>
                        i === idx
                          ? {
                              ...x,
                              quantity: Math.max(1, Math.floor(Number(v || 1))),
                            }
                          : x,
                      ),
                    )
                  }
                />
                <Button
                  color="danger"
                  isDisabled={disabled}
                  variant="flat"
                  onPress={() => onPackagingChange(packaging.filter((_, i) => i !== idx))}
                >
                  Quitar
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="text-sm font-semibold">Resumen agrupado</div>
        {groupedSummary.length === 0 ? (
          <div className="text-sm text-default-500">Sin datos agrupados.</div>
        ) : (
          <div className="rounded-medium border border-default-200">
            <div className="grid grid-cols-2 gap-2 border-b border-default-200 bg-content2 px-3 py-2 text-xs font-semibold uppercase text-default-500">
              <div>Talla</div>
              <div>Cantidad</div>
            </div>
            {groupedSummary.map((row, idx) => (
              <div
                key={`${row.size}-${idx}`}
                className="grid grid-cols-2 gap-2 px-3 py-2 text-sm"
              >
                <div>{row.size}</div>
                <div>{row.quantity}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
