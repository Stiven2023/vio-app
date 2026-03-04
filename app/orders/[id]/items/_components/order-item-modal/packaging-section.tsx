"use client";

import type {
  OrderItemPackagingInput,
  PackagingMode,
} from "@/app/orders/_lib/order-item-types";

import React from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";

import {
  parseIndividualPackagingFromRows,
  readExcelFirstSheetRows,
} from "@/app/orders/_lib/excel";

const KIDS_SIZES = ["2", "4", "6", "8", "10", "12", "14", "16"];
const ADULT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];

function parseCount(value: string) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return 0;

  const n = Number(digits);

  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function formatCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "";

  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function PackagingSection({
  mode: _mode,
  packaging,
  garmentType,
  disabled,
  onModeChange: _onModeChange,
  onPackagingChange,
  onError,
}: {
  mode: PackagingMode;
  packaging: OrderItemPackagingInput[];
  garmentType?: string;
  disabled: boolean;
  onModeChange: (next: PackagingMode) => void;
  onPackagingChange: (next: OrderItemPackagingInput[]) => void;
  onError?: (message: string) => void;
}) {
  const groupedRows = (packaging ?? []).filter((p) => String(p.mode ?? "").toUpperCase() === "AGRUPADO");
  const individualRows = (packaging ?? []).filter((p) => String(p.mode ?? "").toUpperCase() !== "AGRUPADO");

  const groupedMap = React.useMemo(() => {
    const map = new Map<string, number>();

    for (const row of groupedRows) {
      const size = String(row.size ?? "").trim().toUpperCase();
      if (!size) continue;
      const qty = Number(row.quantity ?? 0);
      const safeQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;

      if (safeQty <= 0) continue;
      map.set(size, (map.get(size) ?? 0) + safeQty);
    }

    return map;
  }, [groupedRows]);

  const getGroupedQty = (size: string) => groupedMap.get(String(size).toUpperCase()) ?? 0;

  const kidsTotal = KIDS_SIZES.reduce((acc, size) => acc + getGroupedQty(size), 0);
  const adultsTotal = ADULT_SIZES.reduce((acc, size) => acc + getGroupedQty(size), 0);

  const setGroupedQty = (size: string, raw: string) => {
    const qty = parseCount(raw);
    const normalized = String(size).trim().toUpperCase();
    const currentGrouped = (packaging ?? [])
      .filter((row) => String(row.mode ?? "").toUpperCase() === "AGRUPADO")
      .filter((row) => String(row.size ?? "").trim() !== "");
    const currentIndividual = (packaging ?? []).filter(
      (row) => String(row.mode ?? "").toUpperCase() !== "AGRUPADO",
    );

    const nextGrouped = currentGrouped.filter(
      (row) => String(row.size ?? "").trim().toUpperCase() !== normalized,
    );

    if (qty > 0) {
      nextGrouped.push({ mode: "AGRUPADO", size: normalized, quantity: qty });
    }

    onPackagingChange([...nextGrouped, ...currentIndividual]);
  };

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

      onPackagingChange([...groupedRows, ...next]);
    } catch (e: any) {
      onError?.(e?.message ?? "No se pudo importar el Excel de empaque");
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">Empaque · {String(garmentType ?? "JUGADOR")}</div>

      <div className="space-y-2">
        <div className="text-xs text-default-500">
          Curva de tallas (admite centenas y miles, ej: 1.250).
        </div>
        <div className="rounded-medium border border-default-200 overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-[100px_repeat(8,minmax(70px,1fr))_90px] gap-1 border-b border-default-200 bg-content2 px-2 py-2 text-xs font-semibold uppercase text-default-600">
            <div>Niño</div>
            {KIDS_SIZES.map((size) => (
              <div key={`head-kid-${size}`} className="text-center">{size}</div>
            ))}
            <div className="text-center rounded-small bg-primary text-primary-foreground">Total</div>
          </div>

          <div className="grid min-w-[900px] grid-cols-[100px_repeat(8,minmax(70px,1fr))_90px] gap-1 px-2 py-2 items-center">
            <div className="text-sm font-semibold">Talla</div>
            {KIDS_SIZES.map((size) => (
              <Input
                key={`kid-${size}`}
                isDisabled={disabled}
                placeholder="0"
                value={formatCount(getGroupedQty(size))}
                onValueChange={(v: string) => setGroupedQty(size, v)}
              />
            ))}
            <div className="text-center font-semibold rounded-small bg-primary text-primary-foreground py-2 px-1">{formatCount(kidsTotal) || "0"}</div>
          </div>

          <div className="grid min-w-[900px] grid-cols-[100px_repeat(8,minmax(70px,1fr))_90px] gap-1 border-y border-default-200 bg-content2 px-2 py-2 text-xs font-semibold uppercase text-default-600">
            <div>Adulto</div>
            {ADULT_SIZES.map((size) => (
              <div key={`head-adult-${size}`} className="text-center">{size}</div>
            ))}
            <div className="text-center rounded-small bg-primary text-primary-foreground">Total</div>
          </div>

          <div className="grid min-w-[900px] grid-cols-[100px_repeat(8,minmax(70px,1fr))_90px] gap-1 px-2 py-2 items-center">
            <div className="text-sm font-semibold">Talla</div>
            {ADULT_SIZES.map((size) => (
              <Input
                key={`adult-${size}`}
                isDisabled={disabled}
                placeholder="0"
                value={formatCount(getGroupedQty(size))}
                onValueChange={(v: string) => setGroupedQty(size, v)}
              />
            ))}
            <div className="text-center font-semibold rounded-small bg-primary text-primary-foreground py-2 px-1">{formatCount(adultsTotal) || "0"}</div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-default-600">
            Total curva: <span className="font-semibold">{formatCount(kidsTotal + adultsTotal) || "0"}</span>
          </div>
          <Button
            isDisabled={disabled}
            size="sm"
            variant="flat"
            onPress={() => onPackagingChange(individualRows)}
          >
            Limpiar curva
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Lista de empaque</div>
          <Button
            isDisabled={disabled}
            size="sm"
            variant="flat"
            onPress={() =>
              onPackagingChange([
                ...groupedRows,
                ...individualRows,
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

        {individualRows.length === 0 ? (
          <div className="text-sm text-default-500">Sin registros.</div>
        ) : (
          <div className="rounded-medium border border-default-200 overflow-x-auto">
            <div className="grid min-w-[780px] grid-cols-[120px_1.6fr_1fr_100px_120px] gap-2 border-b border-default-200 bg-content2 px-3 py-2 text-xs font-semibold uppercase text-default-500">
              <div>Numero</div>
              <div>Nombre</div>
              <div>Talla</div>
              <div>Cantidad</div>
              <div></div>
            </div>

            {individualRows.map((p, idx) => (
              <div
                key={`${p.personNumber ?? ""}-${idx}`}
                className="grid min-w-[780px] grid-cols-[120px_1.6fr_1fr_100px_120px] gap-2 px-3 py-2 text-sm"
              >
                <Input
                  isDisabled={disabled}
                  size="sm"
                  value={String(p.personNumber ?? "")}
                  onValueChange={(v: string) => {
                    const next = [...individualRows];
                    next[idx] = { ...next[idx], mode: "INDIVIDUAL", personNumber: v };
                    onPackagingChange([...groupedRows, ...next]);
                  }}
                />
                <Input
                  isDisabled={disabled}
                  size="sm"
                  value={String(p.personName ?? "")}
                  onValueChange={(v: string) => {
                    const next = [...individualRows];
                    next[idx] = { ...next[idx], mode: "INDIVIDUAL", personName: v };
                    onPackagingChange([...groupedRows, ...next]);
                  }}
                />
                <Input
                  isDisabled={disabled}
                  size="sm"
                  value={String(p.size ?? "")}
                  onValueChange={(v: string) => {
                    const next = [...individualRows];
                    next[idx] = { ...next[idx], mode: "INDIVIDUAL", size: v };
                    onPackagingChange([...groupedRows, ...next]);
                  }}
                />
                <Input
                  isDisabled={disabled}
                  size="sm"
                  placeholder="0"
                  value={formatCount(Number(p.quantity ?? 0))}
                  onValueChange={(v: string) => {
                    const next = [...individualRows];
                    next[idx] = {
                      ...next[idx],
                      mode: "INDIVIDUAL",
                      quantity: Math.max(1, parseCount(v)),
                    };
                    onPackagingChange([...groupedRows, ...next]);
                  }}
                />
                <Button
                  color="danger"
                  isDisabled={disabled}
                  size="sm"
                  variant="flat"
                  onPress={() => {
                    const next = individualRows.filter((_, i) => i !== idx);
                    onPackagingChange([...groupedRows, ...next]);
                  }}
                >
                  Quitar
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
