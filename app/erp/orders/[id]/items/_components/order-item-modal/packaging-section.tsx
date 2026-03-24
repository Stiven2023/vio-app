"use client";

import type {
  OrderItemPackagingInput,
  PackagingMode,
} from "@/app/erp/orders/_lib/order-item-types";

import React from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";

import {
  parseIndividualPackagingFromRows,
  readExcelFirstSheetRows,
} from "@/app/erp/orders/_lib/excel";

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

function buildGroupedFromIndividuals(rows: OrderItemPackagingInput[]) {
  const map = new Map<string, number>();

  for (const row of rows) {
    const size = String(row.size ?? "")
      .trim()
      .toUpperCase();

    if (!size) continue;
    map.set(size, (map.get(size) ?? 0) + 1);
  }

  return Array.from(map.entries()).map(([size, quantity]) => ({
    mode: "AGRUPADO" as const,
    size,
    quantity,
  }));
}

function splitCsvLine(line: string) {
  const out: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if ((ch === "," || ch === ";") && !quoted) {
      out.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  out.push(current.trim());

  return out;
}

function csvEscape(value: string) {
  if (/[",\n;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export function PackagingSection({
  mode: _mode,
  packaging,
  maxCurveQuantity,
  garmentType,
  disabled,
  onModeChange: _onModeChange,
  onPackagingChange,
  onError,
}: {
  mode: PackagingMode;
  packaging: OrderItemPackagingInput[];
  maxCurveQuantity?: number;
  garmentType?: string;
  disabled: boolean;
  onModeChange: (next: PackagingMode) => void;
  onPackagingChange: (next: OrderItemPackagingInput[]) => void;
  onError?: (message: string) => void;
}) {
  const [curveExceeded, setCurveExceeded] = React.useState(false);
  const individualRows = (packaging ?? [])
    .filter((p) => String(p.mode ?? "").toUpperCase() !== "AGRUPADO")
    .flatMap((p) => {
      const qty = Math.max(1, Math.floor(Number(p.quantity ?? 1)));

      return Array.from({ length: qty }).map(() => ({
        ...p,
        mode: "INDIVIDUAL" as const,
        quantity: 1,
      }));
    });
  const groupedRows = React.useMemo(
    () => buildGroupedFromIndividuals(individualRows),
    [individualRows],
  );
  const isObjectGarment =
    String(garmentType ?? "")
      .trim()
      .toUpperCase() === "OBJETO";

  const groupedMap = React.useMemo(() => {
    const map = new Map<string, number>();

    for (const row of groupedRows) {
      const size = String(row.size ?? "")
        .trim()
        .toUpperCase();

      if (!size) continue;
      const qty = Number(row.quantity ?? 0);
      const safeQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;

      if (safeQty <= 0) continue;
      map.set(size, (map.get(size) ?? 0) + safeQty);
    }

    return map;
  }, [groupedRows]);

  const getGroupedQty = (size: string) =>
    groupedMap.get(String(size).toUpperCase()) ?? 0;

  const kidsTotal = KIDS_SIZES.reduce(
    (acc, size) => acc + getGroupedQty(size),
    0,
  );
  const adultsTotal = ADULT_SIZES.reduce(
    (acc, size) => acc + getGroupedQty(size),
    0,
  );
  const groupedTotal = kidsTotal + adultsTotal;
  const individualTotal = React.useMemo(
    () =>
      individualRows.reduce((acc, row) => {
        const qty = Number(row.quantity ?? 0);

        return acc + (Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0);
      }, 0),
    [individualRows],
  );
  const pendingToAssign = Math.max(0, groupedTotal - individualTotal);
  const maxAllowedCurve = Number.isFinite(Number(maxCurveQuantity))
    ? Math.max(0, Math.floor(Number(maxCurveQuantity)))
    : null;
  const isCurveOverLimit =
    (maxAllowedCurve !== null && groupedTotal > maxAllowedCurve) ||
    curveExceeded;

  const syncFromIndividuals = React.useCallback(
    (rows: OrderItemPackagingInput[]) => {
      const normalized = rows.map((r) => ({
        ...r,
        mode: "INDIVIDUAL" as const,
        quantity: 1,
      }));
      const grouped = buildGroupedFromIndividuals(normalized);

      onPackagingChange([...grouped, ...normalized]);
    },
    [onPackagingChange],
  );

  const setGroupedQty = (size: string, raw: string) => {
    const qty = parseCount(raw);
    const normalized = String(size).trim().toUpperCase();
    const nextIndividuals = [...individualRows];
    const currentBySize = nextIndividuals.filter(
      (row) => String(row.size ?? "").trim().toUpperCase() === normalized,
    ).length;

    const currentTotal = nextIndividuals.length;
    const nextTotal = currentTotal - currentBySize + qty;

    if (maxAllowedCurve !== null && nextTotal > maxAllowedCurve) {
      setCurveExceeded(true);
      onError?.(
        `La curva no puede superar la cantidad del diseño (${formatCount(maxAllowedCurve)}).`,
      );

      return;
    }

    if (qty > currentBySize) {
      const delta = qty - currentBySize;

      for (let i = 0; i < delta; i += 1) {
        nextIndividuals.push({
          mode: "INDIVIDUAL",
          size: normalized,
          quantity: 1,
          personName: "",
          personNumber: "",
        });
      }
    } else if (qty < currentBySize) {
      let toRemove = currentBySize - qty;

      for (let i = nextIndividuals.length - 1; i >= 0 && toRemove > 0; i -= 1) {
        const sameSize =
          String(nextIndividuals[i].size ?? "").trim().toUpperCase() === normalized;

        if (!sameSize) continue;
        nextIndividuals.splice(i, 1);
        toRemove -= 1;
      }
    }

    if (maxAllowedCurve !== null && nextIndividuals.length > maxAllowedCurve) {
        setCurveExceeded(true);
        onError?.(
          `La curva no puede superar la cantidad del diseño (${formatCount(maxAllowedCurve)}).`,
        );

        return;
    }

    setCurveExceeded(false);
    syncFromIndividuals(nextIndividuals);
  };

  async function onImportExcel(file: File) {
    try {
      const rows = await readExcelFirstSheetRows(file);
      const parsed = parseIndividualPackagingFromRows(rows);

      const next: OrderItemPackagingInput[] = parsed.flatMap((p) => {
        const qty = Math.max(1, Math.floor(Number(p.quantity ?? 1)));

        return Array.from({ length: qty }).map(() => ({
          mode: "INDIVIDUAL",
          size: p.size,
          quantity: 1,
          personName: p.personName,
          personNumber: p.personNumber,
        }));
      });

      syncFromIndividuals(next);
    } catch (e: any) {
      onError?.(e?.message ?? "No se pudo importar el Excel de empaque");
    }
  }

  async function onImportCsv(file: File) {
    try {
      const text = await file.text();
      const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        onError?.("El CSV está vacío.");

        return;
      }

      const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
      const rows = lines.slice(1).map((line) => splitCsvLine(line));

      const next: OrderItemPackagingInput[] = [];

      if (isObjectGarment) {
        const qtyIdx = headers.findIndex(
          (h) => h === "cantidad" || h === "qty" || h === "quantity",
        );

        if (qtyIdx < 0) {
          onError?.("CSV inválido: para OBJETO se requiere columna 'cantidad'.");

          return;
        }

        for (const row of rows) {
          const qty = Math.max(1, parseCount(row[qtyIdx] ?? "0"));

          for (let i = 0; i < qty; i += 1) {
            next.push({
              mode: "INDIVIDUAL",
              size: "",
              quantity: 1,
              personName: "",
              personNumber: "",
            });
          }
        }
      } else {
        const numberIdx = headers.findIndex(
          (h) => h === "numero" || h === "número" || h === "number",
        );
        const nameIdx = headers.findIndex(
          (h) => h === "nombre" || h === "name",
        );
        const sizeIdx = headers.findIndex(
          (h) => h === "talla" || h === "size",
        );
        const qtyIdx = headers.findIndex(
          (h) => h === "cantidad" || h === "qty" || h === "quantity",
        );

        if (sizeIdx < 0) {
          onError?.("CSV inválido: falta la columna 'talla'.");

          return;
        }

        for (const row of rows) {
          const size = String(row[sizeIdx] ?? "").trim();

          if (!size) continue;

          const qty = qtyIdx >= 0 ? Math.max(1, parseCount(row[qtyIdx] ?? "0")) : 1;

          for (let i = 0; i < qty; i += 1) {
            next.push({
              mode: "INDIVIDUAL",
              size,
              quantity: 1,
              personName: nameIdx >= 0 ? String(row[nameIdx] ?? "") : "",
              personNumber: numberIdx >= 0 ? String(row[numberIdx] ?? "") : "",
            });
          }
        }
      }

      syncFromIndividuals(next);
    } catch {
      onError?.("No se pudo importar el CSV de empaque.");
    }
  }

  async function onImportFile(file: File) {
    const lower = file.name.toLowerCase();

    if (lower.endsWith(".csv")) {
      await onImportCsv(file);

      return;
    }

    await onImportExcel(file);
  }

  function downloadCsv(rows: OrderItemPackagingInput[], filename: string) {
    const lines: string[] = [];

    if (isObjectGarment) {
      lines.push("cantidad");
      for (const row of rows) {
        lines.push(String(Math.max(1, Number(row.quantity ?? 1))));
      }
    } else {
      lines.push("numero,nombre,talla");
      for (const row of rows) {
        lines.push(
          [
            csvEscape(String(row.personNumber ?? "")),
            csvEscape(String(row.personName ?? "")),
            csvEscape(String(row.size ?? "")),
          ].join(","),
        );
      }
    }

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">
        Empaque · {String(garmentType ?? "JUGADOR")}
      </div>

      <div className="space-y-2">
        <div className="text-xs text-default-500">
          Curva de tallas (admite centenas y miles, ej: 1.250).
        </div>
        <div className="rounded-medium border border-default-200 overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-[100px_repeat(8,minmax(70px,1fr))_90px] gap-1 border-b border-default-200 bg-content2 px-2 py-2 text-xs font-semibold uppercase text-default-600">
            <div>Niño</div>
            {KIDS_SIZES.map((size) => (
              <div key={`head-kid-${size}`} className="text-center">
                {size}
              </div>
            ))}
            <div className="text-center rounded-small bg-primary text-primary-foreground">
              Total
            </div>
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
            <div
              className={`text-center font-semibold rounded-small py-2 px-1 ${
                isCurveOverLimit
                  ? "bg-danger text-danger-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {formatCount(kidsTotal) || "0"}
            </div>
          </div>

          <div className="grid min-w-[900px] grid-cols-[100px_repeat(8,minmax(70px,1fr))_90px] gap-1 border-y border-default-200 bg-content2 px-2 py-2 text-xs font-semibold uppercase text-default-600">
            <div>Adulto</div>
            {ADULT_SIZES.map((size) => (
              <div key={`head-adult-${size}`} className="text-center">
                {size}
              </div>
            ))}
            <div className="text-center rounded-small bg-primary text-primary-foreground">
              Total
            </div>
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
            <div
              className={`text-center font-semibold rounded-small py-2 px-1 ${
                isCurveOverLimit
                  ? "bg-danger text-danger-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {formatCount(adultsTotal) || "0"}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div
            className={`text-sm ${isCurveOverLimit ? "text-danger" : "text-default-600"}`}
          >
            Total curva:{" "}
            <span className="font-semibold">
              {formatCount(kidsTotal + adultsTotal) || "0"}
            </span>
          </div>
          <Button
            isDisabled={disabled}
            size="sm"
            variant="flat"
            onPress={() => {
              setCurveExceeded(false);
              syncFromIndividuals([]);
            }}
          >
            Limpiar curva
          </Button>
        </div>

        {maxAllowedCurve !== null ? (
          <div
            className={`text-xs ${isCurveOverLimit ? "text-danger" : "text-default-500"}`}
          >
            Máximo permitido por diseño: {formatCount(maxAllowedCurve) || "0"}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Lista de empaque</div>
          <Button
            isDisabled={disabled}
            size="sm"
            variant="flat"
            onPress={() => {
              if (groupedTotal > 0 && pendingToAssign <= 0) {
                onError?.(
                  "La lista de empaque ya tiene asignada toda la cantidad de la curva.",
                );

                return;
              }

              syncFromIndividuals([
                ...individualRows,
                {
                  mode: "INDIVIDUAL",
                  size: "",
                  quantity: 1,
                  personName: "",
                  personNumber: "",
                },
              ]);
            }}
          >
            Agregar
          </Button>
        </div>

        <div className="rounded-medium border border-default-200 bg-content2 px-3 py-2 text-xs text-default-600">
          <span className="font-semibold">Curva:</span> {formatCount(groupedTotal) || "0"}
          {"  ·  "}
          <span className="font-semibold">Lista:</span> {formatCount(individualTotal) || "0"}
          {"  ·  "}
          <span className="font-semibold">Pendiente:</span> {formatCount(pendingToAssign) || "0"}
        </div>

        {groupedTotal > 0 && individualTotal !== groupedTotal ? (
          <div className="text-xs text-warning">
            La suma de la lista de empaque debe ser igual al total de la curva.
          </div>
        ) : null}

        <div className="rounded-medium border border-default-200 bg-content2/40 p-3 space-y-2">
          <div className="text-sm font-semibold">Importar / Exportar lista</div>
          <input
            accept=".csv,.xlsx,.xls"
            disabled={disabled}
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0];

              if (!f) return;

              onImportFile(f);
              e.currentTarget.value = "";
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              isDisabled={disabled}
              size="sm"
              variant="flat"
              onPress={() => downloadCsv([], isObjectGarment ? "plantilla-empaque-objeto.csv" : "plantilla-empaque.csv")}
            >
              Descargar plantilla CSV
            </Button>
            <Button
              isDisabled={disabled || individualRows.length === 0}
              size="sm"
              variant="flat"
              onPress={() =>
                downloadCsv(
                  individualRows,
                  isObjectGarment
                    ? "lista-empaque-objeto.csv"
                    : "lista-empaque.csv",
                )
              }
            >
              Descargar lista CSV
            </Button>
          </div>
          <div className="text-xs text-default-500 mt-1">
            {isObjectGarment
              ? "CSV OBJETO: cantidad."
              : "CSV normal: numero, nombre, talla (cada fila cuenta como 1)."}
          </div>
        </div>

        {individualRows.length === 0 ? (
          <div className="text-sm text-default-500">Sin registros.</div>
        ) : isObjectGarment ? (
          <div className="rounded-medium border border-default-200 overflow-x-auto">
            <div className="grid min-w-[360px] grid-cols-[1fr_120px] gap-2 border-b border-default-200 bg-content2 px-3 py-2 text-xs font-semibold uppercase text-default-500">
              <div>Item</div>
              <div />
            </div>

            {individualRows.map((p, idx) => (
              <div
                key={`${idx}`}
                className="grid min-w-[360px] grid-cols-[1fr_120px] gap-2 px-3 py-2 text-sm"
              >
                <div className="rounded-medium border border-default-200 bg-content1 px-3 py-2 text-default-600">
                  Unidad {idx + 1}
                </div>
                <Button
                  color="danger"
                  isDisabled={disabled}
                  size="sm"
                  variant="flat"
                  onPress={() => {
                    const next = individualRows.filter((_, i) => i !== idx);

                    syncFromIndividuals(next);
                  }}
                >
                  Quitar
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-medium border border-default-200 overflow-x-auto">
            <div className="grid min-w-[720px] grid-cols-[120px_1.6fr_1fr_120px] gap-2 border-b border-default-200 bg-content2 px-3 py-2 text-xs font-semibold uppercase text-default-500">
              <div>Numero</div>
              <div>Nombre</div>
              <div>Talla</div>
              <div />
            </div>

            {individualRows.map((p, idx) => (
              <div
                key={`${p.personNumber ?? ""}-${idx}`}
                className="grid min-w-[720px] grid-cols-[120px_1.6fr_1fr_120px] gap-2 px-3 py-2 text-sm"
              >
                <Input
                  isDisabled={disabled}
                  size="sm"
                  value={String(p.personNumber ?? "")}
                  onValueChange={(v: string) => {
                    const next = [...individualRows];

                    next[idx] = {
                      ...next[idx],
                      mode: "INDIVIDUAL",
                      quantity: 1,
                      personNumber: v,
                    };
                    syncFromIndividuals(next);
                  }}
                />
                <Input
                  isDisabled={disabled}
                  size="sm"
                  value={String(p.personName ?? "")}
                  onValueChange={(v: string) => {
                    const next = [...individualRows];

                    next[idx] = {
                      ...next[idx],
                      mode: "INDIVIDUAL",
                      quantity: 1,
                      personName: v,
                    };
                    syncFromIndividuals(next);
                  }}
                />
                <Input
                  isDisabled={disabled}
                  size="sm"
                  value={String(p.size ?? "")}
                  onValueChange={(v: string) => {
                    const next = [...individualRows];

                    next[idx] = {
                      ...next[idx],
                      mode: "INDIVIDUAL",
                      quantity: 1,
                      size: v,
                    };
                    syncFromIndividuals(next);
                  }}
                />
                <Button
                  color="danger"
                  isDisabled={disabled}
                  size="sm"
                  variant="flat"
                  onPress={() => {
                    const next = individualRows.filter((_, i) => i !== idx);

                    syncFromIndividuals(next);
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
