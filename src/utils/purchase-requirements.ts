import { and, eq, gt, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  inventoryItems,
  orderItemMoldingInsumos,
  orderItemMoldings,
  orderItems,
  purchaseRequirementLines,
  purchaseRequirements,
} from "@/src/db/erp/schema";
import { getDesignFullView } from "@/src/utils/design-overview";

function toLineDescription(requirement: {
  label: string;
  value: string | null;
  details: string | null;
}) {
  const base = requirement.value
    ? `${requirement.label}: ${requirement.value}`
    : requirement.label;

  if (!requirement.details) return base;

  return `${base}. ${requirement.details}`;
}

/**
 * Builds BOM-based purchase requirement lines from `order_item_molding_insumos`
 * where `qty_to_purchase > 0`. Falls back to hint-based lines if no BOM data.
 */
export async function ensurePurchaseRequirementsForOrder(args: {
  dbOrTx?: any;
  orderId: string;
  createdBy: string | null;
}) {
  const dbOrTx = args.dbOrTx ?? db;
  const orderId = String(args.orderId ?? "").trim();

  if (!orderId) return { created: 0, skipped: 0 };

  const items = await dbOrTx
    .select({
      id: orderItems.id,
      name: orderItems.name,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  if (items.length === 0) return { created: 0, skipped: 0 };

  const existing = await dbOrTx
    .select({ orderItemId: purchaseRequirements.orderItemId })
    .from(purchaseRequirements)
    .where(
      inArray(
        purchaseRequirements.orderItemId,
        items.map((item: { id: string }) => item.id),
      ),
    );

  const existingSet = new Set(
    existing.map((row: { orderItemId: string }) => String(row.orderItemId)),
  );
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    if (existingSet.has(String(item.id))) {
      skipped += 1;
      continue;
    }

    // ── BOM path: query real molding insumos ──────────────────────────────
    const moldings = await dbOrTx
      .select({ id: orderItemMoldings.id })
      .from(orderItemMoldings)
      .where(eq(orderItemMoldings.orderItemId, item.id));

    const moldingIds: string[] = moldings.map(
      (m: { id: string }) => m.id,
    );

    let bomLines: Array<{
      purchaseRequirementId: string;
      category: string;
      description: string;
      qtyPlanned: string;
      unit: string;
      coverageStatus: string;
      inventoryItemId: string | null;
      orderItemMoldingInsumoId: string | null;
    }> = [];

    const insumoIdsToMarkSolicited: string[] = [];

    if (moldingIds.length > 0) {
      const insumos = await dbOrTx
        .select({
          id: orderItemMoldingInsumos.id,
          inventoryItemId: orderItemMoldingInsumos.inventoryItemId,
          qtyToPurchase: orderItemMoldingInsumos.qtyToPurchase,
          unit: orderItemMoldingInsumos.unit,
          size: orderItemMoldingInsumos.size,
          itemName: inventoryItems.name,
          itemCode: inventoryItems.itemCode,
        })
        .from(orderItemMoldingInsumos)
        .innerJoin(
          inventoryItems,
          eq(orderItemMoldingInsumos.inventoryItemId, inventoryItems.id),
        )
        .where(
          and(
            inArray(orderItemMoldingInsumos.orderItemMoldingId, moldingIds),
            gt(orderItemMoldingInsumos.qtyToPurchase, "0"),
          ),
        );

      bomLines = insumos.map(
        (ins: {
          id: string;
          inventoryItemId: string;
          qtyToPurchase: string;
          unit: string;
          size: string | null;
          itemName: string;
          itemCode: string;
        }) => {
          insumoIdsToMarkSolicited.push(ins.id);
          const sizeLabel = ins.size ? ` (talla ${ins.size})` : "";
          return {
            purchaseRequirementId: "", // filled after insert
            category: "INSUMO",
            description: `${ins.itemCode} - ${ins.itemName}${sizeLabel}`,
            qtyPlanned: String(ins.qtyToPurchase),
            unit: ins.unit,
            coverageStatus: "PENDIENTE",
            inventoryItemId: ins.inventoryItemId,
            orderItemMoldingInsumoId: ins.id,
          };
        },
      );
    }

    // ── Fallback: qualitative hints ───────────────────────────────────────
    let hintLines: Array<{
      purchaseRequirementId: string;
      category: string;
      description: string;
      qtyPlanned: string;
      unit: string;
      coverageStatus: string;
      inventoryItemId: null;
      orderItemMoldingInsumoId: null;
    }> = [];

    const design = await getDesignFullView(item.id).catch(() => null);
    const hints = design?.purchaseHints ?? null;

    if (bomLines.length === 0) {
      const qtyTotal = Number(hints?.qtyTotal ?? item.quantity ?? 0);
      const qtyPlanned = Number.isFinite(qtyTotal)
        ? String(Math.max(0, qtyTotal))
        : "0";

      hintLines = (hints?.requirements ?? [])
        .filter((req: any) => req.status !== "DISABLED")
        .map((req: any) => ({
          purchaseRequirementId: "",
          category: req.source ?? "GENERAL",
          description: toLineDescription(req),
          qtyPlanned,
          unit: "UN",
          coverageStatus: "PENDIENTE",
          inventoryItemId: null,
          orderItemMoldingInsumoId: null,
        }));
    }

    // ── Insert requirement header ─────────────────────────────────────────
    const [createdRequirement] = await dbOrTx
      .insert(purchaseRequirements)
      .values({
        orderId,
        orderItemId: item.id,
        status: "BORRADOR",
        hintsSnapshot: hints,
        createdBy: args.createdBy,
      })
      .returning({ id: purchaseRequirements.id });

    if (!createdRequirement) continue;

    const allLines = [...bomLines, ...hintLines].map((l) => ({
      ...l,
      purchaseRequirementId: createdRequirement.id,
    }));

    if (allLines.length > 0) {
      await dbOrTx.insert(purchaseRequirementLines).values(allLines as any);
    }

    // Mark insumos as SOLICITADO_COMPRAS so MES knows they're in purchasing
    if (insumoIdsToMarkSolicited.length > 0) {
      await dbOrTx
        .update(orderItemMoldingInsumos)
        .set({ status: "SOLICITADO_COMPRAS" })
        .where(inArray(orderItemMoldingInsumos.id, insumoIdsToMarkSolicited));
    }

    created += 1;
  }

  return { created, skipped };
}
