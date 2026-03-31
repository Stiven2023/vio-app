import { eq, ne, sql } from "drizzle-orm";

import { orderItems, prefacturas, quotationItems } from "@/src/db/schema";

function asNumber(value: unknown) {
  const parsed = Number(String(value ?? "0"));

  return Number.isFinite(parsed) ? parsed : 0;
}

export async function resolveOrderAgreedUnits(
  dbOrTx: any,
  orderId: string,
) {
  const [sourceRow] = await dbOrTx
    .select({ quotationId: prefacturas.quotationId })
    .from(prefacturas)
    .where(eq(prefacturas.orderId, orderId))
    .orderBy(sql`${prefacturas.createdAt} desc`)
    .limit(1);

  const quotationId = String(sourceRow?.quotationId ?? "").trim();

  if (!quotationId) return null;

  const [agreedRow] = await dbOrTx
    .select({
      totalUnits: sql<string>`coalesce(sum(${quotationItems.quantity}), 0)::text`,
    })
    .from(quotationItems)
    .where(eq(quotationItems.quotationId, quotationId));

  return asNumber(agreedRow?.totalUnits);
}

export async function getProjectedOrderDesignUnits(
  dbOrTx: any,
  args: {
    orderId: string;
    nextItemQuantity: number;
    excludeOrderItemId?: string | null;
  },
) {
  const conditions = [eq(orderItems.orderId, args.orderId)];

  if (args.excludeOrderItemId) {
    conditions.push(ne(orderItems.id, args.excludeOrderItemId));
  }

  const [assignedRow] = await dbOrTx
    .select({
      assignedUnits: sql<string>`coalesce(sum(${orderItems.quantity}), 0)::text`,
    })
    .from(orderItems)
    .where(conditions.length > 1 ? sql`${conditions[0]} and ${conditions[1]}` : conditions[0]);

  const assignedUnits = asNumber(assignedRow?.assignedUnits);

  return {
    assignedUnits,
    projectedUnits: assignedUnits + Math.max(0, args.nextItemQuantity),
  };
}

export async function getOrderDesignQuantityLimitError(
  dbOrTx: any,
  args: {
    orderId: string;
    nextItemQuantity: number;
    excludeOrderItemId?: string | null;
  },
) {
  const agreedUnits = await resolveOrderAgreedUnits(dbOrTx, args.orderId);

  if (agreedUnits === null) return null;

  const { assignedUnits, projectedUnits } = await getProjectedOrderDesignUnits(
    dbOrTx,
    args,
  );

  if (projectedUnits <= agreedUnits) {
    return null;
  }

  return {
    agreedUnits,
    assignedUnits,
    projectedUnits,
    availableUnits: Math.max(0, agreedUnits - assignedUnits),
  };
}