import { eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
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

    const design = await getDesignFullView(item.id).catch(() => null);
    const hints = design?.purchaseHints ?? null;
    const qtyTotal = Number(hints?.qtyTotal ?? item.quantity ?? 0);
    const qtyPlanned = Number.isFinite(qtyTotal) ? String(Math.max(0, qtyTotal)) : "0";

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

    const lines = (hints?.requirements ?? [])
      .filter((req) => req.status !== "DISABLED")
      .map((req) => ({
        purchaseRequirementId: createdRequirement.id,
        category: req.source,
        description: toLineDescription(req),
        qtyPlanned,
        unit: "UN",
        coverageStatus: req.status === "WARNING" ? "PENDIENTE" : "PENDIENTE",
      }));

    if (lines.length > 0) {
      await dbOrTx.insert(purchaseRequirementLines).values(lines as any);
    }

    created += 1;
  }

  return { created, skipped };
}
