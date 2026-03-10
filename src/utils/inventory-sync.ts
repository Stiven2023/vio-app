import { and, eq, inArray, sql } from "drizzle-orm";

import {
  inventoryCategories,
  inventoryItemVariants,
  stockMovements,
  warehouseStock,
  warehouses,
} from "@/src/db/schema";

type InventoryLocation = "BODEGA_PRINCIPAL" | "TIENDA";

const WAREHOUSE_BY_LOCATION: Record<InventoryLocation, string> = {
  BODEGA_PRINCIPAL: "BODEGA_PRINCIPAL",
  TIENDA: "TIENDA",
};

const BASE_CATEGORIES = [
  {
    type: "INSUMOS_PRODUCCION" as const,
    name: "Insumos de produccion",
    description: "Avios, cierres, cordones, cuellos, elasticos y similares.",
  },
  {
    type: "PAPELERIA" as const,
    name: "Papeleria",
    description: "Resmas, carpetas, esferos y material administrativo.",
  },
  {
    type: "ASEO" as const,
    name: "Aseo",
    description: "Productos de limpieza y desinfeccion.",
  },
  {
    type: "REPUESTOS" as const,
    name: "Repuestos",
    description: "Piezas y partes para mantenimiento de maquinaria.",
  },
  {
    type: "REVENTA" as const,
    name: "Reventa",
    description: "Productos comprados para comercializacion directa.",
  },
];

const BASE_WAREHOUSES = [
  {
    code: "BODEGA_PRINCIPAL",
    name: "Bodega principal",
    description: "Bodega principal de suministros.",
    isVirtual: false,
    isExternal: false,
  },
  {
    code: "BODEGA_VIB",
    name: "Bodega VIB",
    description: "Bodega externa para confeccionista VIB.",
    isVirtual: false,
    isExternal: true,
  },
  {
    code: "TIENDA",
    name: "Tienda",
    description: "Punto de venta fisico.",
    isVirtual: false,
    isExternal: false,
  },
  {
    code: "WEB",
    name: "Web",
    description: "Bodega virtual para canal online.",
    isVirtual: true,
    isExternal: false,
  },
];

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

async function recomputeStock(
  dbOrTx: any,
  inventoryItemId: string,
  warehouseId: string,
) {
  const [inboundRow] = await dbOrTx
    .select({
      total: sql<string>`coalesce(sum(${stockMovements.quantity}), 0)::text`,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.inventoryItemId, inventoryItemId),
        eq(stockMovements.toWarehouseId, warehouseId),
      ),
    );

  const [outboundRow] = await dbOrTx
    .select({
      total: sql<string>`coalesce(sum(${stockMovements.quantity}), 0)::text`,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.inventoryItemId, inventoryItemId),
        eq(stockMovements.fromWarehouseId, warehouseId),
      ),
    );

  return asNumber(inboundRow?.total) - asNumber(outboundRow?.total);
}

async function recomputeVariantStock(
  dbOrTx: any,
  variantId: string,
  warehouseId: string,
) {
  const [inboundRow] = await dbOrTx
    .select({
      total: sql<string>`coalesce(sum(${stockMovements.quantity}), 0)::text`,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.variantId, variantId),
        eq(stockMovements.toWarehouseId, warehouseId),
      ),
    );

  const [outboundRow] = await dbOrTx
    .select({
      total: sql<string>`coalesce(sum(${stockMovements.quantity}), 0)::text`,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.variantId, variantId),
        eq(stockMovements.fromWarehouseId, warehouseId),
      ),
    );

  return asNumber(inboundRow?.total) - asNumber(outboundRow?.total);
}

export async function ensureInventoryBaseData(dbOrTx: any) {
  await dbOrTx
    .insert(inventoryCategories)
    .values(BASE_CATEGORIES)
    .onConflictDoNothing({ target: inventoryCategories.type });

  await dbOrTx
    .insert(warehouses)
    .values(BASE_WAREHOUSES)
    .onConflictDoNothing({ target: warehouses.code });
}

async function getWarehouseIdByCode(dbOrTx: any, code: string) {
  const [row] = await dbOrTx
    .select({ id: warehouses.id })
    .from(warehouses)
    .where(eq(warehouses.code, code))
    .limit(1);

  return row?.id ?? null;
}

export async function resolveWarehouseIdByLocation(
  dbOrTx: any,
  location: InventoryLocation,
) {
  await ensureInventoryBaseData(dbOrTx);
  const code = WAREHOUSE_BY_LOCATION[location];

  return getWarehouseIdByCode(dbOrTx, code);
}

async function syncWarehouseStockForItem(
  dbOrTx: any,
  inventoryItemId: string,
  warehouseId: string,
) {
  const stock = await recomputeStock(dbOrTx, inventoryItemId, warehouseId);

  const [existing] = await dbOrTx
    .select({ id: warehouseStock.id })
    .from(warehouseStock)
    .where(
      and(
        eq(warehouseStock.inventoryItemId, inventoryItemId),
        eq(warehouseStock.warehouseId, warehouseId),
      ),
    )
    .limit(1);

  if (!existing) {
    await dbOrTx.insert(warehouseStock).values({
      warehouseId,
      inventoryItemId,
      variantId: null,
      availableQty: String(stock),
      reservedQty: "0",
      lastUpdated: new Date(),
    });

    return;
  }

  await dbOrTx
    .update(warehouseStock)
    .set({
      availableQty: String(stock),
      lastUpdated: new Date(),
    })
    .where(eq(warehouseStock.id, existing.id));
}

export async function computeStockForItem(
  dbOrTx: any,
  inventoryItemId: string,
  location?: InventoryLocation,
) {
  if (location) {
    const warehouseId = await resolveWarehouseIdByLocation(dbOrTx, location);
    if (!warehouseId) return 0;

    const [row] = await dbOrTx
      .select({ availableQty: warehouseStock.availableQty })
      .from(warehouseStock)
      .where(
        and(
          eq(warehouseStock.inventoryItemId, inventoryItemId),
          eq(warehouseStock.warehouseId, warehouseId),
        ),
      )
      .limit(1);

    return asNumber(row?.availableQty);
  }

  const [row] = await dbOrTx
    .select({
      total: sql<string>`coalesce(sum(${warehouseStock.availableQty}), 0)::text`,
    })
    .from(warehouseStock)
    .where(eq(warehouseStock.inventoryItemId, inventoryItemId));

  return asNumber(row?.total);
}

export async function computeStockForItemInWarehouse(
  dbOrTx: any,
  inventoryItemId: string,
  warehouseId: string,
) {
  const [row] = await dbOrTx
    .select({ availableQty: warehouseStock.availableQty })
    .from(warehouseStock)
    .where(
      and(
        eq(warehouseStock.inventoryItemId, inventoryItemId),
        eq(warehouseStock.warehouseId, warehouseId),
      ),
    )
    .limit(1);

  return asNumber(row?.availableQty);
}

export async function computeStockForVariantInWarehouse(
  dbOrTx: any,
  variantId: string,
  warehouseId: string,
) {
  const [row] = await dbOrTx
    .select({ availableQty: warehouseStock.availableQty })
    .from(warehouseStock)
    .where(
      and(
        eq(warehouseStock.variantId, variantId),
        eq(warehouseStock.warehouseId, warehouseId),
      ),
    )
    .limit(1);

  return asNumber(row?.availableQty);
}

async function syncWarehouseStockForVariant(
  dbOrTx: any,
  variantId: string,
  warehouseId: string,
) {
  const stock = await recomputeVariantStock(dbOrTx, variantId, warehouseId);

  const [existing] = await dbOrTx
    .select({ id: warehouseStock.id, minStock: warehouseStock.minStock })
    .from(warehouseStock)
    .where(
      and(
        eq(warehouseStock.variantId, variantId),
        eq(warehouseStock.warehouseId, warehouseId),
      ),
    )
    .limit(1);

  if (!existing) {
    await dbOrTx.insert(warehouseStock).values({
      warehouseId,
      inventoryItemId: null,
      variantId,
      availableQty: String(stock),
      reservedQty: "0",
      minStock: "0",
      lastUpdated: new Date(),
    });

    return;
  }

  await dbOrTx
    .update(warehouseStock)
    .set({
      availableQty: String(stock),
      lastUpdated: new Date(),
    })
    .where(eq(warehouseStock.id, existing.id));
}

export async function syncInventoryForVariant(dbOrTx: any, variantId: string) {
  const id = String(variantId ?? "").trim();
  if (!id) return;

  await ensureInventoryBaseData(dbOrTx);

  const [tiendaWarehouseId] = await Promise.all([
    resolveWarehouseIdByLocation(dbOrTx, "TIENDA"),
  ]);
  const webWarehouseId = await getWarehouseIdByCode(dbOrTx, "WEB");

  const movementWarehouses = await dbOrTx
    .select({
      fromWarehouseId: stockMovements.fromWarehouseId,
      toWarehouseId: stockMovements.toWarehouseId,
    })
    .from(stockMovements)
    .where(eq(stockMovements.variantId, id));

  const warehouseIds = new Set<string>();

  if (tiendaWarehouseId) warehouseIds.add(tiendaWarehouseId);

  for (const row of movementWarehouses) {
    if (row.fromWarehouseId) warehouseIds.add(row.fromWarehouseId);
    if (row.toWarehouseId) warehouseIds.add(row.toWarehouseId);
  }

  for (const warehouseId of warehouseIds) {
    await syncWarehouseStockForVariant(dbOrTx, id, warehouseId);
  }

  // WEB mirrors TIENDA stock for same variant.
  if (tiendaWarehouseId && webWarehouseId) {
    const [tiendaRow] = await dbOrTx
      .select({
        availableQty: warehouseStock.availableQty,
        reservedQty: warehouseStock.reservedQty,
        minStock: warehouseStock.minStock,
      })
      .from(warehouseStock)
      .where(
        and(
          eq(warehouseStock.variantId, id),
          eq(warehouseStock.warehouseId, tiendaWarehouseId),
        ),
      )
      .limit(1);

    const [webRow] = await dbOrTx
      .select({ id: warehouseStock.id })
      .from(warehouseStock)
      .where(
        and(
          eq(warehouseStock.variantId, id),
          eq(warehouseStock.warehouseId, webWarehouseId),
        ),
      )
      .limit(1);

    if (webRow?.id) {
      await dbOrTx
        .update(warehouseStock)
        .set({
          availableQty: tiendaRow?.availableQty ?? "0",
          reservedQty: tiendaRow?.reservedQty ?? "0",
          minStock: tiendaRow?.minStock ?? "0",
          lastUpdated: new Date(),
        })
        .where(eq(warehouseStock.id, webRow.id));
    } else {
      await dbOrTx.insert(warehouseStock).values({
        warehouseId: webWarehouseId,
        inventoryItemId: null,
        variantId: id,
        availableQty: tiendaRow?.availableQty ?? "0",
        reservedQty: tiendaRow?.reservedQty ?? "0",
        minStock: tiendaRow?.minStock ?? "0",
        lastUpdated: new Date(),
      });
    }
  }

  const [variant] = await dbOrTx
    .select({ inventoryItemId: inventoryItemVariants.inventoryItemId })
    .from(inventoryItemVariants)
    .where(eq(inventoryItemVariants.id, id))
    .limit(1);

  if (variant?.inventoryItemId) {
    await syncInventoryForItem(dbOrTx, variant.inventoryItemId);
  }
}

export async function syncInventoryForItem(dbOrTx: any, inventoryItemId: string) {
  const id = String(inventoryItemId ?? "").trim();
  if (!id) return;

  await ensureInventoryBaseData(dbOrTx);

  const [principalWarehouseId, tiendaWarehouseId] = await Promise.all([
    resolveWarehouseIdByLocation(dbOrTx, "BODEGA_PRINCIPAL"),
    resolveWarehouseIdByLocation(dbOrTx, "TIENDA"),
  ]);
  const webWarehouseId = await getWarehouseIdByCode(dbOrTx, "WEB");

  const movementWarehouses = await dbOrTx
    .select({
      fromWarehouseId: stockMovements.fromWarehouseId,
      toWarehouseId: stockMovements.toWarehouseId,
    })
    .from(stockMovements)
    .where(eq(stockMovements.inventoryItemId, id));

  const warehouseIds = new Set<string>();

  if (principalWarehouseId) warehouseIds.add(principalWarehouseId);
  if (tiendaWarehouseId) warehouseIds.add(tiendaWarehouseId);

  for (const row of movementWarehouses) {
    if (row.fromWarehouseId) warehouseIds.add(row.fromWarehouseId);
    if (row.toWarehouseId) warehouseIds.add(row.toWarehouseId);
  }

  if (warehouseIds.size === 0) {
    const allWarehouses = await dbOrTx
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(inArray(warehouses.code, ["BODEGA_PRINCIPAL", "TIENDA", "WEB"]));

    allWarehouses.forEach((row: { id: string }) => warehouseIds.add(row.id));
  }

  for (const warehouseId of warehouseIds) {
    await syncWarehouseStockForItem(dbOrTx, id, warehouseId);
  }

  // WEB mirrors TIENDA stock for same item.
  if (tiendaWarehouseId && webWarehouseId) {
    const [tiendaRow] = await dbOrTx
      .select({
        availableQty: warehouseStock.availableQty,
        reservedQty: warehouseStock.reservedQty,
        minStock: warehouseStock.minStock,
      })
      .from(warehouseStock)
      .where(
        and(
          eq(warehouseStock.inventoryItemId, id),
          eq(warehouseStock.warehouseId, tiendaWarehouseId),
        ),
      )
      .limit(1);

    const [webRow] = await dbOrTx
      .select({ id: warehouseStock.id })
      .from(warehouseStock)
      .where(
        and(
          eq(warehouseStock.inventoryItemId, id),
          eq(warehouseStock.warehouseId, webWarehouseId),
        ),
      )
      .limit(1);

    if (webRow?.id) {
      await dbOrTx
        .update(warehouseStock)
        .set({
          availableQty: tiendaRow?.availableQty ?? "0",
          reservedQty: tiendaRow?.reservedQty ?? "0",
          minStock: tiendaRow?.minStock ?? "0",
          lastUpdated: new Date(),
        })
        .where(eq(warehouseStock.id, webRow.id));
    } else {
      await dbOrTx.insert(warehouseStock).values({
        warehouseId: webWarehouseId,
        inventoryItemId: id,
        variantId: null,
        availableQty: tiendaRow?.availableQty ?? "0",
        reservedQty: tiendaRow?.reservedQty ?? "0",
        minStock: tiendaRow?.minStock ?? "0",
        lastUpdated: new Date(),
      });
    }
  }
}
