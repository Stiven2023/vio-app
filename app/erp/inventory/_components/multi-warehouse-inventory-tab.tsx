"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";

import { apiJson, getErrorMessage } from "@/app/erp/catalog/_lib/api";

const INSUMO_PREFIXES = new Set(["INS", "INV", "PAP", "ASE", "REP"]);

const CATEGORY_BY_PREFIX: Record<string, string> = {
  MP: "Materia prima",
  TEL: "Telas",
  EMP: "Empaques",
  INS: "Insumos producción",
  INV: "Insumos varios",
  PAP: "Papelería",
  ASE: "Aseo",
  REP: "Repuestos",
  REV: "Reventa",
};

type ScopeId = "principal" | "produccion" | "tienda" | "muestras" | "insumos";

type ScopeDef = {
  id: ScopeId;
  label: string;
  color: string;
  description: string;
};

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  purpose: string | null;
  isActive: boolean | null;
};

type WarehouseProductRow = {
  stockId: string;
  inventoryItemId: string | null;
  variantId: string | null;
  itemCode: string | null;
  itemName: string | null;
  variantSku: string | null;
  variantColor?: string | null;
  variantSize?: string | null;
  availableQty: string | null;
};

type WarehouseMoveRow = {
  id: string;
  createdAt: string | null;
  quantity: string | null;
  reason: string | null;
  notes: string | null;
  itemCode: string | null;
  itemName: string | null;
  variantSku?: string | null;
  fromWarehouseName?: string | null;
  toWarehouseName?: string | null;
};

type WarehouseDetailsResponse = {
  products: WarehouseProductRow[];
  entries: WarehouseMoveRow[];
  outputs: WarehouseMoveRow[];
};

type WarehouseOverviewResponse = {
  warehouses: WarehouseRow[];
  detailsByWarehouse: Record<string, WarehouseDetailsResponse>;
  pricesByItemCode: Record<string, string>;
};

type AggregatedRow = {
  key: string;
  inventoryItemId: string | null;
  itemCode: string;
  itemName: string;
  variantSku: string;
  category: string;
  typeLabel: string;
  totalQty: number;
  byWarehouse: Record<string, number>;
  unitPrice: number;
};

type MovementRow = {
  id: string;
  direction: "in" | "out";
  date: string;
  qty: number;
  unitLabel: string;
  itemName: string;
  itemCode: string;
  fromName: string;
  toName: string;
};

const SCOPES: ScopeDef[] = [
  {
    id: "principal",
    label: "Inventario principal",
    color: "#888780",
    description: "Consolidado comercial de bodegas activas",
  },
  {
    id: "produccion",
    label: "Producción",
    color: "#1D9E75",
    description: "Materia prima y proceso productivo",
  },
  {
    id: "tienda",
    label: "Tienda",
    color: "#378ADD",
    description: "Stock para venta directa",
  },
  {
    id: "muestras",
    label: "Muestras",
    color: "#7F77DD",
    description: "Productos de exhibición y demo",
  },
  {
    id: "insumos",
    label: "Insumos internos",
    color: "#D85A30",
    description: "Aseo, papelería, tintas y reposición interna",
  },
];

function toNumber(value: string | null | undefined) {
  const parsed = Number(String(value ?? "0"));

  return Number.isFinite(parsed) ? parsed : 0;
}

function codePrefix(itemCode: string) {
  return String(itemCode).split("-")[0]?.trim().toUpperCase() ?? "";
}

function categoryFromCode(itemCode: string) {
  return CATEGORY_BY_PREFIX[codePrefix(itemCode)] ?? "General";
}

function isInsumoCode(itemCode: string) {
  return INSUMO_PREFIXES.has(codePrefix(itemCode));
}

function typeFromCode(itemCode: string) {
  const prefix = codePrefix(itemCode);

  if (INSUMO_PREFIXES.has(prefix)) return "Insumo";
  if (prefix === "MP" || prefix === "TEL") return "Materia prima";

  return "Producto";
}

function formatWarehouseLabel(warehouse: WarehouseRow) {
  return warehouse.name || warehouse.code;
}

function statusForStock(qty: number, typeLabel: string) {
  if (qty <= 0) return "out";
  if (typeLabel === "Insumo" || typeLabel === "Materia prima") {
    return qty <= 5 ? "low" : "ok";
  }

  return qty <= 10 ? "low" : "ok";
}

function scopeWarehouseIds(scope: ScopeId, warehouses: WarehouseRow[]) {
  if (scope === "principal") return warehouses.map((w) => w.id);

  if (scope === "produccion") {
    return warehouses
      .filter(
        (w) =>
          w.purpose === "PRODUCCION" ||
          w.purpose === "MATERIA_PRIMA" ||
          w.purpose === "PRINCIPAL",
      )
      .map((w) => w.id);
  }

  if (scope === "tienda") {
    return warehouses
      .filter(
        (w) =>
          w.purpose === "TIENDA" ||
          w.purpose === "PRODUCTO_TERMINADO" ||
          /TIENDA|STORE/i.test(`${w.code} ${w.name}`),
      )
      .map((w) => w.id);
  }

  if (scope === "muestras") {
    return warehouses
      .filter(
        (w) =>
          w.purpose === "MUESTRAS" || /MUESTR/i.test(`${w.code} ${w.name}`),
      )
      .map((w) => w.id);
  }

  return warehouses
    .filter(
      (w) =>
        w.purpose === "INSUMOS" ||
        w.purpose === "GENERAL" ||
        /INSUM|ASEO|PAPEL|TINT|REPUEST/i.test(`${w.code} ${w.name}`),
    )
    .map((w) => w.id);
}

export function MultiWarehouseInventoryTab() {
  const [loading, setLoading] = useState(true);
  const [activeScope, setActiveScope] = useState<ScopeId>("principal");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [detailsByWarehouse, setDetailsByWarehouse] = useState<
    Record<string, WarehouseDetailsResponse>
  >({});
  const [priceByItemCode, setPriceByItemCode] = useState<
    Record<string, number>
  >({});

  const activeScopeDef =
    SCOPES.find((scope) => scope.id === activeScope) ?? SCOPES[0];

  const warehouseNameById = useMemo(() => {
    const map: Record<string, string> = {};

    for (const row of warehouses) {
      map[row.id] = formatWarehouseLabel(row);
    }

    return map;
  }, [warehouses]);

  const refreshData = async () => {
    try {
      setLoading(true);

      const overview = await apiJson<WarehouseOverviewResponse>(
        "/api/warehouses/inventory-overview",
      );

      const prices: Record<string, number> = {};

      for (const [itemCode, rawPrice] of Object.entries(
        overview.pricesByItemCode ?? {},
      )) {
        prices[itemCode] = toNumber(rawPrice);
      }

      setWarehouses(overview.warehouses ?? []);
      setDetailsByWarehouse(overview.detailsByWarehouse ?? {});
      setPriceByItemCode(prices);
    } catch (error) {
      toast.error(getErrorMessage(error));
      setWarehouses([]);
      setDetailsByWarehouse({});
      setPriceByItemCode({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const scopedWarehouseIds = useMemo(
    () => scopeWarehouseIds(activeScope, warehouses),
    [activeScope, warehouses],
  );

  const aggregatedRows = useMemo(() => {
    const rows = new Map<string, AggregatedRow>();

    for (const warehouseId of scopedWarehouseIds) {
      const detail = detailsByWarehouse[warehouseId];

      if (!detail) continue;

      for (const product of detail.products ?? []) {
        const qty = toNumber(product.availableQty);
        const itemCode = String(product.itemCode ?? "SIN-COD").trim();
        const variantSku = String(product.variantSku ?? "").trim();
        const itemName = String(product.itemName ?? "Item").trim();
        const key =
          product.inventoryItemId && variantSku
            ? `${product.inventoryItemId}::${variantSku}`
            : `${itemCode}::${variantSku || itemName}`;

        const current = rows.get(key);

        if (!current) {
          const category = categoryFromCode(itemCode);
          const typeLabel = typeFromCode(itemCode);

          rows.set(key, {
            key,
            inventoryItemId: product.inventoryItemId,
            itemCode,
            itemName,
            variantSku,
            category,
            typeLabel,
            totalQty: qty,
            byWarehouse: { [warehouseId]: qty },
            unitPrice: priceByItemCode[itemCode] ?? 0,
          });
          continue;
        }

        current.totalQty += qty;
        current.byWarehouse[warehouseId] =
          (current.byWarehouse[warehouseId] ?? 0) + qty;
      }
    }

    let values = Array.from(rows.values());

    if (activeScope === "insumos") {
      values = values.filter((row) => isInsumoCode(row.itemCode));
    } else {
      values = values.filter((row) => !isInsumoCode(row.itemCode));
    }

    return values.sort((a, b) =>
      `${a.itemCode} ${a.itemName}`.localeCompare(
        `${b.itemCode} ${b.itemName}`,
      ),
    );
  }, [activeScope, detailsByWarehouse, priceByItemCode, scopedWarehouseIds]);

  const categories = useMemo(() => {
    const all = new Set<string>();

    for (const row of aggregatedRows) {
      all.add(row.category);
    }

    return ["Todos", ...Array.from(all).sort((a, b) => a.localeCompare(b))];
  }, [aggregatedRows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return aggregatedRows.filter((row) => {
      const matchSearch =
        !normalizedSearch ||
        row.itemCode.toLowerCase().includes(normalizedSearch) ||
        row.itemName.toLowerCase().includes(normalizedSearch) ||
        row.variantSku.toLowerCase().includes(normalizedSearch);
      const matchCategory =
        categoryFilter === "Todos" || row.category === categoryFilter;

      return matchSearch && matchCategory;
    });
  }, [aggregatedRows, categoryFilter, search]);

  const metrics = useMemo(() => {
    const totalItems = filteredRows.length;
    const totalUnits = filteredRows.reduce((acc, row) => acc + row.totalQty, 0);
    const lowStock = filteredRows.filter(
      (row) => statusForStock(row.totalQty, row.typeLabel) === "low",
    ).length;
    const outStock = filteredRows.filter(
      (row) => statusForStock(row.totalQty, row.typeLabel) === "out",
    ).length;
    const totalValue = filteredRows.reduce(
      (acc, row) => acc + row.totalQty * row.unitPrice,
      0,
    );

    return { totalItems, totalUnits, lowStock, outStock, totalValue };
  }, [filteredRows]);

  const recentMovements = useMemo(() => {
    const rows: MovementRow[] = [];

    for (const warehouseId of scopedWarehouseIds) {
      const detail = detailsByWarehouse[warehouseId];

      if (!detail) continue;

      for (const move of detail.entries ?? []) {
        rows.push({
          id: `${move.id}:in:${warehouseId}`,
          direction: "in",
          date: move.createdAt ?? "",
          qty: toNumber(move.quantity),
          unitLabel: "und",
          itemName: move.itemName ?? "Item",
          itemCode: move.itemCode ?? "SIN-COD",
          fromName: move.fromWarehouseName ?? "Origen externo",
          toName: warehouseNameById[warehouseId] ?? "Bodega",
        });
      }

      for (const move of detail.outputs ?? []) {
        rows.push({
          id: `${move.id}:out:${warehouseId}`,
          direction: "out",
          date: move.createdAt ?? "",
          qty: toNumber(move.quantity),
          unitLabel: "und",
          itemName: move.itemName ?? "Item",
          itemCode: move.itemCode ?? "SIN-COD",
          fromName: warehouseNameById[warehouseId] ?? "Bodega",
          toName: move.toWarehouseName ?? "Destino externo",
        });
      }
    }

    return rows
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [detailsByWarehouse, scopedWarehouseIds, warehouseNameById]);

  if (loading) {
    return (
      <div className="py-8 text-sm text-default-500">
        Cargando inventario multi-bodega...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Inventario Viomar
          </h2>
          <p className="text-xs text-default-500">
            {activeScopeDef.description}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="flat" onPress={refreshData}>
            Actualizar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SCOPES.map((scope) => {
          const active = scope.id === activeScope;

          return (
            <button
              key={scope.id}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs"
              style={{
                borderColor: active ? "#4A5568" : "#D1D5DB",
                background: active ? "#F5F5F5" : "#FFFFFF",
                color: "#111827",
              }}
              type="button"
              onClick={() => setActiveScope(scope.id)}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: scope.color }}
              />
              {scope.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <div className="rounded-md border border-default-200 bg-default-50 px-3 py-2">
          <div className="text-[11px] text-default-500">Referencias</div>
          <div className="text-xl font-semibold">{metrics.totalItems}</div>
        </div>
        <div className="rounded-md border border-default-200 bg-default-50 px-3 py-2">
          <div className="text-[11px] text-default-500">Unidades</div>
          <div className="text-xl font-semibold">
            {metrics.totalUnits.toLocaleString("es-CO")}
          </div>
        </div>
        <div className="rounded-md border border-default-200 bg-default-50 px-3 py-2">
          <div className="text-[11px] text-default-500">Stock bajo</div>
          <div className="text-xl font-semibold text-amber-700">
            {metrics.lowStock}
          </div>
        </div>
        <div className="rounded-md border border-default-200 bg-default-50 px-3 py-2">
          <div className="text-[11px] text-default-500">Sin stock</div>
          <div className="text-xl font-semibold text-rose-700">
            {metrics.outStock}
          </div>
        </div>
        <div className="rounded-md border border-default-200 bg-default-50 px-3 py-2">
          <div className="text-[11px] text-default-500">Valor inventario</div>
          <div className="text-base font-semibold">
            ${Math.round(metrics.totalValue / 1000000).toFixed(1)}M
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          className="sm:flex-1"
          placeholder="Buscar por SKU o nombre"
          value={search}
          onValueChange={setSearch}
        />
        <Select
          aria-label="Filtrar por categoría"
          className="sm:w-72"
          selectedKeys={[categoryFilter]}
          onSelectionChange={(keys) => {
            const key = Array.from(keys)[0];

            setCategoryFilter(String(key ?? "Todos"));
          }}
        >
          {categories.map((category) => (
            <SelectItem key={category}>{category}</SelectItem>
          ))}
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-default-200">
        <div className="overflow-hidden w-full">
          <table className="w-full text-sm">
            <thead className="bg-default-50 text-xs uppercase tracking-wide text-default-500">
              <tr>
                <th className="px-3 py-2 text-left">SKU</th>
                <th className="px-3 py-2 text-left">Producto</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-right">Stock</th>
                {activeScope === "principal" ? (
                  <th className="px-3 py-2 text-left">Distribución</th>
                ) : null}
                <th className="px-3 py-2 text-right">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-10 text-center text-default-500"
                    colSpan={6}
                  >
                    Sin resultados para este filtro.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const status = statusForStock(row.totalQty, row.typeLabel);
                  const statusLabel =
                    status === "ok"
                      ? "Normal"
                      : status === "low"
                        ? "Bajo"
                        : "Agotado";

                  return (
                    <tr key={row.key} className="border-t border-default-200">
                      <td className="px-3 py-2 text-xs text-default-500">
                        {row.variantSku || row.itemCode}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">
                          {row.itemName}
                        </div>
                        <div className="text-xs text-default-500">
                          {row.category}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs text-default-600">
                          {row.typeLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {row.totalQty.toLocaleString("es-CO")}
                      </td>
                      {activeScope === "principal" ? (
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(row.byWarehouse)
                              .filter(([, qty]) => qty > 0)
                              .map(([warehouseId, qty]) => (
                                <span
                                  key={`${row.key}:${warehouseId}`}
                                  className="rounded-full bg-default-100 px-2 py-0.5 text-[11px] text-default-600"
                                >
                                  {warehouseNameById[warehouseId] ??
                                    warehouseId}
                                  : {qty}
                                </span>
                              ))}
                          </div>
                        </td>
                      ) : null}
                      <td className="px-3 py-2 text-right">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs"
                          style={{
                            background:
                              status === "ok"
                                ? "#EAF3DE"
                                : status === "low"
                                  ? "#FAEEDA"
                                  : "#FCEBEB",
                            color:
                              status === "ok"
                                ? "#3B6D11"
                                : status === "low"
                                  ? "#854F0B"
                                  : "#A32D2D",
                          }}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-default-200">
        <div className="flex items-center justify-between border-b border-default-200 bg-default-50 px-3 py-2">
          <h3 className="text-sm font-semibold text-foreground">
            Movimientos recientes
          </h3>
        </div>
        {recentMovements.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-default-500">
            Sin movimientos para esta ubicación.
          </div>
        ) : (
          <div>
            {recentMovements.map((move) => (
              <div
                key={move.id}
                className="flex items-center gap-3 border-t border-default-200 px-3 py-2 text-sm first:border-t-0"
              >
                <div className="min-w-[110px] text-xs text-default-500">
                  {move.date
                    ? new Date(move.date).toLocaleDateString("es-CO")
                    : "-"}
                </div>
                <div className="min-w-4 text-base text-default-400">
                  {move.direction === "in" ? "→" : "←"}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground">
                    {move.itemName}
                  </div>
                  <div className="text-xs text-default-500">
                    {move.fromName} → {move.toName} · SKU: {move.itemCode}
                  </div>
                </div>
                <div
                  className="text-sm font-semibold"
                  style={{
                    color: move.direction === "in" ? "#3B6D11" : "#854F0B",
                  }}
                >
                  {move.direction === "in" ? "+" : "-"}
                  {move.qty.toLocaleString("es-CO")} {move.unitLabel}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
