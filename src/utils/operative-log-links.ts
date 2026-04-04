import { and, eq, inArray, sql } from "drizzle-orm";

import {
  orderItemPackaging,
  orderItems,
  orderItemSocks,
  orders,
} from "@/src/db/erp/schema";

type NullableText = string | null | undefined;

export type OperativeLogLinkState = {
  orderCode?: NullableText;
  designName?: NullableText;
  size?: NullableText;
  orderId?: NullableText;
  orderItemId?: NullableText;
  sourceLegacyOrderItemId?: NullableText;
};

type OperativeLogLinkPatch = Partial<OperativeLogLinkState> &
  Record<string, unknown>;

export type ResolvedOperativeLogLink = {
  orderId: string | null;
  orderItemId: string | null;
  status: string | null;
  strategy: "stored-order-item" | "heuristic" | "order-only" | "unlinked";
};

export function normalizeOperativeLogReference(
  value: unknown,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  const text = String(value).trim();

  return text ? text : null;
}

export function buildOperativeLogLinkFields(args: {
  orderId?: unknown;
  orderItemId?: unknown;
  sourceLegacyOrderItemId?: unknown;
}) {
  return {
    orderId: normalizeOperativeLogReference(args.orderId) ?? null,
    orderItemId: normalizeOperativeLogReference(args.orderItemId) ?? null,
    sourceLegacyOrderItemId:
      normalizeOperativeLogReference(args.sourceLegacyOrderItemId) ?? null,
  };
}

export function getEffectiveOperativeLogLookupInput(
  existing: OperativeLogLinkState,
  patch: OperativeLogLinkPatch,
) {
  return {
    orderCode:
      patch.orderCode !== undefined
        ? normalizeOperativeLogReference(patch.orderCode) ?? null
        : normalizeOperativeLogReference(existing.orderCode) ?? null,
    designName:
      patch.designName !== undefined
        ? normalizeOperativeLogReference(patch.designName) ?? null
        : normalizeOperativeLogReference(existing.designName) ?? null,
    size:
      patch.size !== undefined
        ? normalizeOperativeLogReference(patch.size) ?? null
        : normalizeOperativeLogReference(existing.size) ?? null,
    orderId:
      patch.orderId !== undefined
        ? normalizeOperativeLogReference(patch.orderId) ?? null
        : normalizeOperativeLogReference(existing.orderId) ?? null,
    orderItemId:
      patch.orderItemId !== undefined
        ? normalizeOperativeLogReference(patch.orderItemId) ?? null
        : normalizeOperativeLogReference(existing.orderItemId) ?? null,
  };
}

export function shouldRefreshOperativeLogLink(
  existing: OperativeLogLinkState,
  patch: OperativeLogLinkPatch,
) {
  return (
    patch.orderCode !== undefined ||
    patch.designName !== undefined ||
    patch.size !== undefined ||
    patch.orderId !== undefined ||
    patch.orderItemId !== undefined ||
    !normalizeOperativeLogReference(existing.orderId) ||
    !normalizeOperativeLogReference(existing.orderItemId)
  );
}

function normalizeMatchText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

async function resolveOrderIdByCode(args: {
  erpTx: any;
  orderId?: string | null;
  orderCode?: string | null;
}) {
  const normalizedOrderId = normalizeOperativeLogReference(args.orderId);

  if (normalizedOrderId) {
    const [storedOrder] = await args.erpTx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, normalizedOrderId))
      .limit(1);

    if (storedOrder?.id) {
      return String(storedOrder.id);
    }
  }

  const normalizedOrderCode = normalizeOperativeLogReference(args.orderCode);

  if (!normalizedOrderCode) {
    return null;
  }

  const [orderRow] = await args.erpTx
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.orderCode, normalizedOrderCode))
    .limit(1);

  return orderRow?.id ? String(orderRow.id) : null;
}

async function resolveStoredOrderItem(args: {
  erpTx: any;
  orderItemId?: string | null;
}) {
  const normalizedOrderItemId = normalizeOperativeLogReference(args.orderItemId);

  if (!normalizedOrderItemId) {
    return null;
  }

  const [storedItem] = await args.erpTx
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      status: orderItems.status,
    })
    .from(orderItems)
    .where(eq(orderItems.id, normalizedOrderItemId))
    .limit(1);

  if (!storedItem?.id) {
    return null;
  }

  return {
    orderId: storedItem.orderId ? String(storedItem.orderId) : null,
    orderItemId: String(storedItem.id),
    status: storedItem.status ? String(storedItem.status) : null,
    strategy: "stored-order-item" as const,
  };
}

async function resolveHeuristicOrderItem(args: {
  erpTx: any;
  orderCode?: string | null;
  designName?: string | null;
  size?: string | null;
}) {
  const orderCode = normalizeOperativeLogReference(args.orderCode);
  const designName = normalizeMatchText(args.designName);
  const size = normalizeMatchText(args.size);

  if (!orderCode || !designName) {
    return null;
  }

  const candidates = await args.erpTx
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      status: orderItems.status,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.orderCode, orderCode),
        sql`lower(trim(coalesce(${orderItems.name}, ''))) = ${designName}`,
      ),
    )
    .limit(20);

  if (!candidates.length) {
    return null;
  }

  if (!size) {
    const firstCandidate = candidates[0];

    return firstCandidate
      ? {
          orderId: firstCandidate.orderId
            ? String(firstCandidate.orderId)
            : null,
          orderItemId: String(firstCandidate.id),
          status: firstCandidate.status ? String(firstCandidate.status) : null,
          strategy: "heuristic" as const,
        }
      : null;
  }

  const candidateIds = candidates.map(
    (candidate: { id: string }) => candidate.id,
  );
  const packagingMatches = await args.erpTx
    .select({ orderItemId: orderItemPackaging.orderItemId })
    .from(orderItemPackaging)
    .where(
      and(
        inArray(orderItemPackaging.orderItemId, candidateIds),
        sql`lower(trim(coalesce(${orderItemPackaging.size}, ''))) = ${size}`,
      ),
    );

  const socksMatches = await args.erpTx
    .select({ orderItemId: orderItemSocks.orderItemId })
    .from(orderItemSocks)
    .where(
      and(
        inArray(orderItemSocks.orderItemId, candidateIds),
        sql`lower(trim(coalesce(${orderItemSocks.size}, ''))) = ${size}`,
      ),
    );

  const allowedIds = new Set(
    [...packagingMatches, ...socksMatches]
      .map((row) => String(row.orderItemId ?? "").trim())
      .filter(Boolean),
  );

  if (!allowedIds.size) {
    return null;
  }

  const matchedCandidate = candidates.find((candidate: { id: string }) =>
    allowedIds.has(String(candidate.id)),
  );

  if (!matchedCandidate) {
    return null;
  }

  return {
    orderId: matchedCandidate.orderId ? String(matchedCandidate.orderId) : null,
    orderItemId: String(matchedCandidate.id),
    status: matchedCandidate.status ? String(matchedCandidate.status) : null,
    strategy: "heuristic" as const,
  };
}

export async function resolveOperativeLogLink(args: {
  erpTx: any;
  orderCode?: string | null;
  designName?: string | null;
  size?: string | null;
  storedOrderId?: string | null;
  storedOrderItemId?: string | null;
}): Promise<ResolvedOperativeLogLink> {
  const storedItem = await resolveStoredOrderItem({
    erpTx: args.erpTx,
    orderItemId: args.storedOrderItemId,
  });

  if (storedItem) {
    return storedItem;
  }

  const orderId = await resolveOrderIdByCode({
    erpTx: args.erpTx,
    orderId: args.storedOrderId,
    orderCode: args.orderCode,
  });
  const heuristicItem = await resolveHeuristicOrderItem({
    erpTx: args.erpTx,
    orderCode: args.orderCode,
    designName: args.designName,
    size: args.size,
  });

  if (heuristicItem) {
    return {
      orderId: heuristicItem.orderId ?? orderId,
      orderItemId: heuristicItem.orderItemId,
      status: heuristicItem.status,
      strategy: heuristicItem.strategy,
    };
  }

  if (orderId) {
    return {
      orderId,
      orderItemId: null,
      status: null,
      strategy: "order-only",
    };
  }

  return {
    orderId: null,
    orderItemId: null,
    status: null,
    strategy: "unlinked",
  };
}