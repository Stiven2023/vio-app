import { and, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  ORDER_ITEM_STATUS,
  ORDER_ITEM_STATUS_VALUES,
  ORDER_STATUS,
} from "@/src/utils/order-status";
import {
  additions,
  employees,
  inventoryItems,
  orderItemAdditions,
  orderItemPositions,
  orderItemSpecialRequirements,
  orderItemTeams,
  stockMovements,
  orderItemMaterials,
  orderItemPackaging,
  orderItemSocks,
  orderItemStatusHistory,
  orderItems,
  orders,
  orderStatusHistory,
  prefacturas,
  products,
  quotations,
} from "@/src/db/erp/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { createNotificationsForPermission } from "@/src/utils/notifications";
import { getOrderDesignQuantityLimitError } from "@/src/utils/order-item-quantity-limit";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { canRoleChangeStatus } from "@/src/utils/role-status";
import { shouldRouteDesignUpdateToApproval } from "@/src/utils/design-workflow";
import { getLatestUsdCopRate } from "@/src/utils/exchange-rate";
import { getItemLeadDays } from "@/src/utils/quotation-delivery";
import { ensurePurchaseRequirementsForOrder } from "@/src/utils/purchase-requirements";

const orderItemStatuses = new Set<string>(ORDER_ITEM_STATUS_VALUES);

const GARMENT_TYPES = new Set([
  "JUGADOR",
  "ARQUERO",
  "CAPITAN",
  "JUEZ",
  "ENTRENADOR",
  "LIBERO",
  "OBJETO",
]);

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

async function recalcOrderTotal(tx: any, orderId: string) {
  const [{ subtotal }] = await tx
    .select({
      subtotal: sql<string>`coalesce(sum(coalesce(${orderItems.totalPrice}, ${orderItems.unitPrice} * ${orderItems.quantity})), 0)::text`,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const [o] = await tx
    .select({ discount: orders.discount })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  const discountPercent = Math.min(100, Math.max(0, asNumber(o?.discount)));
  const subtotalNumber = asNumber(subtotal);
  const totalAfterDiscount = subtotalNumber * (1 - discountPercent / 100);

  await tx
    .update(orders)
    .set({ total: String(totalAfterDiscount) })
    .where(eq(orders.id, orderId));
}

async function syncOrderStatusFromItems(
  tx: any,
  orderId: string,
  changedBy: string | null,
) {
  const [resume] = await tx
    .select({
      total: sql<number>`count(*)::int`,
      pendingProduction: sql<number>`sum(case when ${orderItems.status} = 'PENDIENTE_PRODUCCION' then 1 else 0 end)::int`,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const total = Number(resume?.total ?? 0);
  const pendingProduction = Number(resume?.pendingProduction ?? 0);

  if (!total || pendingProduction !== total) {
    return;
  }

  const [orderRow] = await tx
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderRow) return;

  // APROBACION → PROGRAMACION cuando todos los diseños son aprobados
  if (orderRow.status === ORDER_STATUS.APROBACION) {
    await tx
      .update(orders)
      .set({ status: ORDER_STATUS.PROGRAMACION as any })
      .where(eq(orders.id, orderId));

    await ensurePurchaseRequirementsForOrder({
      dbOrTx: tx,
      orderId,
      createdBy: changedBy,
    });

    await tx.insert(orderStatusHistory).values({
      orderId,
      status: ORDER_STATUS.PROGRAMACION,
      changedBy,
    });

    return;
  }

  // PROGRAMACION → PRODUCCION cuando todos los diseños están en pendiente producción
  if (orderRow.status !== ORDER_STATUS.PROGRAMACION) return;

  await tx
    .update(orders)
    .set({ status: ORDER_STATUS.PRODUCCION as any })
    .where(eq(orders.id, orderId));

  await tx.insert(orderStatusHistory).values({
    orderId,
    status: ORDER_STATUS.PRODUCCION,
    changedBy,
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-items:get-one",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const orderItemId = String(id ?? "").trim();

  if (!orderItemId) return new Response("id required", { status: 400 });

  const [itemRow] = await db
    .select({
      item: orderItems,
      productName: products.name,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.id, orderItemId))
    .limit(1);

  if (!itemRow?.item) return new Response("Not found", { status: 404 });

  const item = {
    ...itemRow.item,
    productName: itemRow.productName ?? null,
  };

  const packaging = await db
    .select()
    .from(orderItemPackaging)
    .where(eq(orderItemPackaging.orderItemId, orderItemId));

  const socks = await db
    .select()
    .from(orderItemSocks)
    .where(eq(orderItemSocks.orderItemId, orderItemId));

  const materialsRows = await db
    .select({
      orderItemId: orderItemMaterials.orderItemId,
      inventoryItemId: orderItemMaterials.inventoryItemId,
      quantity: orderItemMaterials.quantity,
      note: orderItemMaterials.note,
      itemName: inventoryItems.name,
      unit: inventoryItems.unit,
    })
    .from(orderItemMaterials)
    .leftJoin(
      inventoryItems,
      eq(orderItemMaterials.inventoryItemId, inventoryItems.id),
    )
    .where(eq(orderItemMaterials.orderItemId, orderItemId));

  const deliveredRows = await db
    .select({
      inventoryItemId: stockMovements.inventoryItemId,
      deliveredQty: sql<string>`coalesce(sum(coalesce(${stockMovements.quantity}, 0)::numeric), 0)::text`,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.referenceType, "ORDER_ITEM"),
        eq(stockMovements.referenceId, orderItemId),
        eq(stockMovements.movementType, "SALIDA"),
      ),
    )
    .groupBy(stockMovements.inventoryItemId);

  const deliveredByItem = new Map(
    deliveredRows
      .filter((r) => r.inventoryItemId)
      .map((r) => [String(r.inventoryItemId), r.deliveredQty]),
  );

  const materials = materialsRows.map((m) => ({
    ...m,
    deliveredQty: m.inventoryItemId
      ? (deliveredByItem.get(String(m.inventoryItemId)) ?? "0")
      : "0",
  }));

  const additionsRows = await db
    .select({
      id: orderItemAdditions.id,
      additionId: orderItemAdditions.additionId,
      quantity: orderItemAdditions.quantity,
      unitPrice: orderItemAdditions.unitPrice,
      additionName: additions.name,
      additionCode: additions.additionCode,
    })
    .from(orderItemAdditions)
    .leftJoin(additions, eq(orderItemAdditions.additionId, additions.id))
    .where(eq(orderItemAdditions.orderItemId, orderItemId));

  const positions = await db
    .select()
    .from(orderItemPositions)
    .where(eq(orderItemPositions.orderItemId, orderItemId));

  const teams = await db
    .select()
    .from(orderItemTeams)
    .where(eq(orderItemTeams.orderItemId, orderItemId));

  const specialRequirements = await db
    .select()
    .from(orderItemSpecialRequirements)
    .where(eq(orderItemSpecialRequirements.orderItemId, orderItemId));

  const legacyCuffType =
    specialRequirements.find((row) => String(row.cuffType ?? "").trim())
      ?.cuffType ?? null;

  const itemWithFallback = {
    ...item,
    cuffType: item.cuffType ?? legacyCuffType,
  };

  return Response.json({
    item: itemWithFallback,
    packaging,
    socks,
    materials,
    additions: additionsRows,
    positions,
    teams,
    specialRequirements,
  });
}

function toNullableString(v: unknown) {
  const s = String(v ?? "").trim();

  return s ? s : null;
}

function toNullableNumericString(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v));

  if (Number.isNaN(n)) return null;

  return String(n);
}

function toPositiveInt(v: unknown) {
  const n = Number(String(v));

  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);

  return i > 0 ? i : null;
}

function normalizeClosureQuantity(v: unknown) {
  const n = toPositiveInt(v);

  if (n === 1 || n === 2 || n === 4) return n;

  return null;
}

function normalizeOperationalProcess(v: unknown) {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();

  if (raw === "BODEGA" || raw === "COMPRAS" || raw === "PRODUCCION") {
    return raw;
  }

  return "PRODUCCION";
}

function normalizeDesignType(v: unknown) {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();

  if (raw === "PRODUCCION") return "PRODUCCION";
  if (raw === "COMPRA" || raw === "COMPRAS") return "COMPRA";
  if (raw === "BODEGA") return "BODEGA";

  return "PRODUCCION";
}

function normalizeProductionTechnique(v: unknown) {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();

  if (raw === "FONDO_ENTERO") return "FONDO_ENTERO";
  if (raw === "SUBLIMACION") return "SUBLIMACION";

  return "SUBLIMACION";
}

function normalizeScreenPrintType(v: unknown) {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();

  if (raw === "DTF") return "DTF";
  if (raw === "VINILO") return "VINILO";

  return null;
}

function normalizePosition(v: unknown) {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();

  if (
    raw === "JUGADOR" ||
    raw === "ARQUERO" ||
    raw === "CAPITAN" ||
    raw === "JUEZ" ||
    raw === "ENTRENADOR" ||
    raw === "LIBERO" ||
    raw === "ADICIONAL"
  ) {
    return raw;
  }

  return null;
}

function normalizeSockLength(v: unknown) {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();

  if (raw === "LARGA" || raw === "TRES_CUARTOS" || raw === "TALONERA") {
    return raw;
  }

  return null;
}

function normalizeOrderConfigurationMode(v: unknown) {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();

  if (raw === "PRENDA") return "PRENDA";
  if (raw === "CONJUNTO") return "CONJUNTO";
  if (raw === "CONJUNTO_ARQUERO") return "CONJUNTO_ARQUERO";

  return null;
}

function validatePositionsBusiness(
  positionsInput: unknown,
  orderConfigurationModeInput: unknown,
) {
  const orderConfigurationMode = normalizeOrderConfigurationMode(
    orderConfigurationModeInput,
  );

  if (
    orderConfigurationMode !== "CONJUNTO_ARQUERO" &&
    (!Array.isArray(positionsInput) || positionsInput.length === 0)
  ) {
    return null;
  }

  if (!Array.isArray(positionsInput) || positionsInput.length === 0) {
    return "Debes configurar posiciones y cantidades para conjunto + arquero.";
  }

  const normalized = positionsInput
    .map((row: any) => ({
      position: normalizePosition(row?.position),
      quantity: Number(row?.quantity ?? 0),
    }))
    .filter((row: any) => Boolean(row.position));

  if (normalized.length === 0) {
    return "Las posiciones del diseño son inválidas.";
  }

  if (normalized.some((row: any) => !Number.isFinite(row.quantity) || row.quantity < 0)) {
    return "La cantidad por posición no puede ser negativa.";
  }

  if (orderConfigurationMode !== "CONJUNTO_ARQUERO") {
    return null;
  }

  const set = new Set(normalized.map((row: any) => row.position));

  if (!(set.has("JUGADOR") && set.has("ARQUERO"))) {
    return "Para conjunto + arquero debes definir al menos JUGADOR y ARQUERO.";
  }

  return null;
}

function positionsContainGoalkeeper(
  positionsInput: Array<{ position?: string | null }> | null | undefined,
) {
  return (positionsInput ?? []).some(
    (row) => normalizePosition(row?.position) === "ARQUERO",
  );
}

function sumGroupedPackagingQuantity(packagingInput: unknown) {
  if (!Array.isArray(packagingInput)) return 0;

  return packagingInput.reduce((acc, row: any) => {
    const mode = String(row?.mode ?? "AGRUPADO")
      .trim()
      .toUpperCase();

    if (mode !== "AGRUPADO") return acc;
    const qty = toPositiveInt(row?.quantity);

    return acc + (qty ?? 0);
  }, 0);
}

function normalizeGarmentType(v: unknown) {
  const raw = String(v ?? "")
    .trim()
    .toUpperCase();

  if (!GARMENT_TYPES.has(raw)) return null;

  return raw;
}

function resolveOrderTypeFromKind(kind: unknown) {
  const normalizedKind = String(kind ?? "NUEVO")
    .trim()
    .toUpperCase();

  if (normalizedKind === "COMPLETACION") return "COMPLETACION";
  if (normalizedKind === "REFERENTE") return "REFERENTE";

  return "NORMAL";
}

function pickCopScaleByQuantity(
  row: typeof products.$inferSelect,
  quantity: number,
) {
  if (quantity <= 499) return row.priceCopR1;
  if (quantity <= 1000) return row.priceCopR2;

  return row.priceCopR3;
}

function resolveUnitPriceByRule(args: {
  currency: string | null | undefined;
  clientPriceType: string | null | undefined;
  quantity: number;
  row: typeof products.$inferSelect;
  manualUnitPrice?: unknown;
  usdCopEffectiveRate?: number | null;
}) {
  const {
    currency,
    clientPriceType,
    quantity,
    row,
    manualUnitPrice,
    usdCopEffectiveRate,
  } = args;

  const currencyCode = String(currency ?? "COP").toUpperCase();
  const manual = toNullableNumericString(manualUnitPrice);

  if (clientPriceType === "AUTORIZADO" && manual) {
    return manual;
  }

  if (currencyCode === "USD") {
    if (row.priceUSD) return row.priceUSD;

    if (
      row.priceCopInternational &&
      usdCopEffectiveRate &&
      usdCopEffectiveRate > 0
    ) {
      return String(asNumber(row.priceCopInternational) / usdCopEffectiveRate);
    }

    return null;
  }

  if (clientPriceType === "VIOMAR" && row.priceViomar) return row.priceViomar;
  if (clientPriceType === "COLANTA" && row.priceColanta)
    return row.priceColanta;
  if (clientPriceType === "MAYORISTA" && row.priceMayorista)
    return row.priceMayorista;

  const copByScale = pickCopScaleByQuantity(row, quantity);

  if (copByScale) return copByScale;

  if (row.priceCopInternational) return row.priceCopInternational;

  if (row.priceUSD && usdCopEffectiveRate && usdCopEffectiveRate > 0) {
    return String(asNumber(row.priceUSD) * usdCopEffectiveRate);
  }

  return null;
}

async function resolveEmployeeId(request: Request) {
  const direct = getEmployeeIdFromRequest(request);

  if (direct) return direct;

  const userId = getUserIdFromRequest(request);

  if (!userId) return null;

  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1);

  return row?.id ?? null;
}

async function assertAdvisorOrderAccess(request: Request, orderId: string) {
  const role = getRoleFromRequest(request);

  if (role !== "ASESOR") return null;

  const employeeId = await resolveEmployeeId(request);

  if (!employeeId) return new Response("Forbidden", { status: 403 });

  const [orderRow] = await db
    .select({ createdBy: orders.createdBy })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderRow) return new Response("Not found", { status: 404 });

  if (orderRow.createdBy !== employeeId) {
    return new Response("Forbidden", { status: 403 });
  }

  return null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-items:put",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const body = (await request.json()) as any;
  const employeeId = await resolveEmployeeId(request);

  if (body.status !== undefined) {
    const forbiddenStatus = await requirePermission(
      request,
      "CAMBIAR_ESTADO_DISEÑO",
    );

    if (forbiddenStatus) return forbiddenStatus;
  }

  const orderItemId = String(id ?? "").trim();

  if (!orderItemId) return new Response("id required", { status: 400 });

  const [existing] = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      name: orderItems.name,
      garmentType: orderItems.garmentType,
      logoImageUrl: orderItems.logoImageUrl,
      clothingImageTwoUrl: orderItems.clothingImageTwoUrl,
      status: orderItems.status,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      hasAdditions: orderItems.hasAdditions,
      additionEvidence: orderItems.additionEvidence,
      designType: orderItems.designType,
      productionTechnique: orderItems.productionTechnique,
      screenPrintType: orderItems.screenPrintType,
      color: orderItems.color,
      cuffType: orderItems.cuffType,
      process: orderItems.process,
    })
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId))
    .limit(1);

  if (!existing) return new Response("Not found", { status: 404 });

  const advisorForbidden = await assertAdvisorOrderAccess(
    request,
    String(existing.orderId ?? ""),
  );

  if (advisorForbidden) return advisorForbidden;

  const [orderRow] = await db
    .select({
      kind: orders.kind,
      currency: orders.currency,
      clientPriceType: sql<string>`coalesce(cast(${prefacturas.clientPriceType} as text), cast(${quotations.clientPriceType} as text), 'VIOMAR')`,
      orderStatus: orders.status,
    })
    .from(orders)
    .leftJoin(prefacturas, eq(prefacturas.orderId, orders.id))
    .leftJoin(quotations, eq(prefacturas.quotationId, quotations.id))
    .where(eq(orders.id, existing.orderId!))
    .limit(1);

  const kind = orderRow?.kind ?? "NUEVO";
  const latestUsdCopRate = await getLatestUsdCopRate();

  const patch: Partial<typeof orderItems.$inferInsert> = {};

  const qty = body.quantity !== undefined ? toPositiveInt(body.quantity) : null;
  const quantityWasChanged =
    body.quantity !== undefined &&
    qty !== null &&
    Number(qty) !== Number(existing.quantity ?? 0);
  const effectiveQuantity = qty ?? Number(existing.quantity ?? 0);

  // Bloquear modificación de cantidad una vez el pedido avanzó a programación o producción
  const QUANTITY_LOCKED_STATUSES = new Set<string>([
    ORDER_STATUS.PROGRAMACION,
    ORDER_STATUS.PRODUCCION,
    ORDER_STATUS.ATRASADO,
    ORDER_STATUS.FINALIZADO,
    ORDER_STATUS.ENTREGADO,
    ORDER_STATUS.CANCELADO,
  ]);

  if (
    quantityWasChanged &&
    QUANTITY_LOCKED_STATUSES.has(String(orderRow?.orderStatus ?? ""))
  ) {
    return new Response(
      "La cantidad del diseño no puede modificarse una vez el pedido ha sido enviado a programación.",
      { status: 422 },
    );
  }

  if (qty !== null) {
    const quantityLimitError = await getOrderDesignQuantityLimitError(db, {
      orderId: String(existing.orderId ?? ""),
      nextItemQuantity: qty,
      excludeOrderItemId: orderItemId,
    });

    if (quantityLimitError) {
      return new Response(
        `La suma de diseños del pedido no puede superar ${quantityLimitError.agreedUnits} unidades acordadas. Disponibles para este diseño: ${quantityLimitError.availableUnits}.`,
        { status: 422 },
      );
    }
  }

  if (Array.isArray(body.packaging)) {
    const groupedPackagingTotal = sumGroupedPackagingQuantity(body.packaging);

    if (groupedPackagingTotal > effectiveQuantity) {
      return new Response(
        `La curva no puede superar la cantidad del diseño (${effectiveQuantity}).`,
        { status: 400 },
      );
    }
  }

  if (body.positions !== undefined) {
    const positionsValidationError = validatePositionsBusiness(
      body.positions,
      body.orderConfigurationMode,
    );

    if (positionsValidationError) {
      return new Response(positionsValidationError, { status: 400 });
    }
  }

  if (
    body.positions === undefined &&
    (body.designType !== undefined ||
      body.process !== undefined ||
      body.teams !== undefined ||
      body.orderConfigurationMode !== undefined)
  ) {
    const existingPositions = await db
      .select({
        position: orderItemPositions.position,
        quantity: orderItemPositions.quantity,
      })
      .from(orderItemPositions)
      .where(eq(orderItemPositions.orderItemId, orderItemId));

    const desiredOrderConfigurationMode =
      normalizeOrderConfigurationMode(body.orderConfigurationMode) ??
      (existing.clothingImageTwoUrl
        ? positionsContainGoalkeeper(existingPositions)
          ? "CONJUNTO_ARQUERO"
          : "CONJUNTO"
        : "PRENDA");

    const positionsValidationError = validatePositionsBusiness(
      existingPositions,
      desiredOrderConfigurationMode,
    );

    if (positionsValidationError) {
      return new Response(
        `${positionsValidationError} Si cambias la configuración sin enviar positions, las posiciones actuales deben cumplir la regla.`,
        { status: 400 },
      );
    }
  }

  // Bloquear edición de contenido desde PRODUCCION (montaje) en adelante.
  // Solo se permiten cambios de estado (status-only).
  const ORDER_MONTAJE_LOCKED_STATUSES = new Set<string>([
    ORDER_STATUS.PRODUCCION,
    ORDER_STATUS.ATRASADO,
    ORDER_STATUS.FINALIZADO,
    ORDER_STATUS.ENTREGADO,
  ]);
  const hasNonStatusBodyFields = Object.keys(body).some((k) => k !== "status");

  if (
    ORDER_MONTAJE_LOCKED_STATUSES.has(String(orderRow?.orderStatus ?? "")) &&
    hasNonStatusBodyFields
  ) {
    return new Response(
      "No se puede modificar el diseño: el pedido está en montaje o superior.",
      { status: 422 },
    );
  }

  // COMPLETACION: solo se permite cambiar quantity y empaques
  if (kind === "COMPLETACION") {
    if (body.status !== undefined) {
      return new Response("status change not allowed for completacion", {
        status: 400,
      });
    }

    if (qty) patch.quantity = qty;

    await db.transaction(async (tx) => {
      if (Object.keys(patch).length > 0) {
        await tx
          .update(orderItems)
          .set(patch)
          .where(eq(orderItems.id, orderItemId));
      }

      if (Array.isArray(body.packaging)) {
        await tx
          .delete(orderItemPackaging)
          .where(eq(orderItemPackaging.orderItemId, orderItemId));

        const packaging = body.packaging as any[];

        if (packaging.length > 0) {
          await tx.insert(orderItemPackaging).values(
            packaging.map((p) => ({
              orderItemId,
              teamId: toNullableString(p.teamId),
              position: normalizePosition(p.position) as any,
              mode: String(p.mode ?? "AGRUPADO"),
              size: String(p.size ?? ""),
              quantity:
                p.quantity === undefined ? null : toPositiveInt(p.quantity),
              personName: toNullableString(p.personName),
              personNumber: toNullableString(p.personNumber),
            })) as any,
          );
        }
      }

      await recalcOrderTotal(tx, existing.orderId!);
    });

    const [res] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, orderItemId));

    return Response.json(res);
  }

  if (qty) patch.quantity = qty;
  const effectiveGarmentType =
    body.garmentType !== undefined
      ? normalizeGarmentType(body.garmentType)
      : normalizeGarmentType(existing.garmentType);

  if (!effectiveGarmentType) {
    return new Response("garmentType inválido", { status: 400 });
  }

  patch.garmentType = effectiveGarmentType;

  if (body.productId !== undefined)
    patch.productId = toNullableString(body.productId);
  if (body.name !== undefined) patch.name = toNullableString(body.name);
  if (body.hasAdditions !== undefined) {
    patch.hasAdditions = Boolean(body.hasAdditions);
  }
  if (body.additionEvidence !== undefined) {
    const evidence = toNullableString(body.additionEvidence);

    patch.additionEvidence = evidence;
    if (evidence) patch.hasAdditions = true;
  }

  const normalizedEffectiveQuantity = Math.max(
    1,
    Math.floor(asNumber(effectiveQuantity)),
  );
  const effectiveProductId =
    body.productId !== undefined
      ? toNullableString(body.productId)
      : toNullableString(existing.productId);

  const manual = toNullableNumericString(
    body.unitPrice !== undefined ? body.unitPrice : existing.unitPrice,
  );

  if (!effectiveProductId) {
    if (String(orderRow?.clientPriceType ?? "VIOMAR") !== "AUTORIZADO") {
      return new Response("productId required", { status: 400 });
    }

    if (!manual) {
      return new Response("productId required", { status: 400 });
    }

    const manualNumber = Math.max(0, asNumber(manual));

    patch.unitPrice = String(manualNumber);
    patch.totalPrice = String(
      manualNumber * Math.max(1, Math.floor(asNumber(effectiveQuantity))),
    );
  } else {
    const [productRow] = await db
      .select()
      .from(products)
      .where(eq(products.id, effectiveProductId))
      .limit(1);

    if (!productRow || productRow.isActive === false) {
      return new Response("producto requerido", { status: 400 });
    }

    const resolvedUnitPrice = resolveUnitPriceByRule({
      currency: orderRow?.currency,
      clientPriceType: orderRow?.clientPriceType,
      quantity: normalizedEffectiveQuantity,
      row: productRow,
      manualUnitPrice:
        body.unitPrice !== undefined ? body.unitPrice : existing.unitPrice,
      usdCopEffectiveRate: latestUsdCopRate?.effectiveRate ?? null,
    });

    if (!resolvedUnitPrice) {
      return new Response(
        "No hay precio aplicable para este cliente y cantidad",
        {
          status: 400,
        },
      );
    }

    const resolvedUnitNumber = Math.max(0, asNumber(resolvedUnitPrice));

    patch.unitPrice = String(resolvedUnitNumber);
    patch.totalPrice = String(resolvedUnitNumber * normalizedEffectiveQuantity);
  }
  if (body.observations !== undefined)
    patch.observations = toNullableString(body.observations);
  if (body.fabric !== undefined) patch.fabric = toNullableString(body.fabric);
  if (body.designType !== undefined) {
    patch.designType = normalizeDesignType(body.designType) as any;
  }
  if (body.productionTechnique !== undefined) {
    patch.productionTechnique = normalizeProductionTechnique(
      body.productionTechnique,
    ) as any;
  }
  if (body.imageUrl !== undefined)
    patch.imageUrl = toNullableString(body.imageUrl);
  if (body.clothingImageOneUrl !== undefined) {
    patch.clothingImageOneUrl = toNullableString(body.clothingImageOneUrl);
    patch.imageUrl = toNullableString(body.clothingImageOneUrl);
  }
  if (body.clothingImageTwoUrl !== undefined)
    patch.clothingImageTwoUrl = toNullableString(body.clothingImageTwoUrl);
  if (body.logoImageUrl !== undefined)
    patch.logoImageUrl = toNullableString(body.logoImageUrl);
  if (body.screenPrintType !== undefined) {
    const normalizedScreenPrintType = normalizeScreenPrintType(
      body.screenPrintType,
    );

    patch.screenPrintType = normalizedScreenPrintType;
    patch.screenPrint = Boolean(normalizedScreenPrintType);
  } else if (body.screenPrint !== undefined) {
    const nextScreenPrint = Boolean(body.screenPrint);

    patch.screenPrint = nextScreenPrint;

    if (!nextScreenPrint) {
      patch.screenPrintType = null;
    } else if (!toNullableString(existing.screenPrintType)) {
      patch.screenPrintType = "DTF";
    }
  }
  if (body.embroidery !== undefined)
    patch.embroidery = Boolean(body.embroidery);
  if (body.buttonhole !== undefined)
    patch.buttonhole = Boolean(body.buttonhole);
  if (body.snap !== undefined) patch.snap = Boolean(body.snap);
  if (body.tag !== undefined) patch.tag = Boolean(body.tag);
  if (body.flag !== undefined) patch.flag = Boolean(body.flag);
  if (body.gender !== undefined) patch.gender = toNullableString(body.gender);
  if (body.designerId !== undefined)
    patch.designerId = toNullableString(body.designerId);
  if (body.discipline !== undefined)
    patch.discipline = toNullableString(body.discipline);
  if (body.hasCordon !== undefined) patch.hasCordon = Boolean(body.hasCordon);
  if (body.cordonColor !== undefined)
    patch.cordonColor = toNullableString(body.cordonColor);
  if (body.category !== undefined) patch.category = toNullableString(body.category);
  if (body.labelBrand !== undefined)
    patch.labelBrand = toNullableString(body.labelBrand);
  if (body.process !== undefined) {
    patch.process = normalizeOperationalProcess(body.process);
  }
  if (body.neckType !== undefined)
    patch.neckType = toNullableString(body.neckType);
  if (body.cuffType !== undefined)
    patch.cuffType = toNullableString(body.cuffType);
  if (body.sleeve !== undefined) patch.sleeve = toNullableString(body.sleeve);
  if (body.color !== undefined) patch.color = toNullableString(body.color);
  if (body.requiresSocks !== undefined)
    patch.requiresSocks = Boolean(body.requiresSocks);
  if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive);
  if (body.manufacturingId !== undefined)
    patch.manufacturingId = toNullableString(body.manufacturingId);
  if (patch.hasAdditions === false) {
    patch.additionEvidence = null;
  }

  const effectiveLogoImageUrl =
    patch.logoImageUrl !== undefined
      ? toNullableString(patch.logoImageUrl)
      : toNullableString(existing.logoImageUrl);

  if (!effectiveLogoImageUrl) {
    return new Response("logoImageUrl es obligatorio", { status: 400 });
  }

  const effectiveTechnique = normalizeProductionTechnique(
    patch.productionTechnique !== undefined
      ? patch.productionTechnique
      : body.productionTechnique ?? existing.productionTechnique,
  );

  if (effectiveTechnique === "FONDO_ENTERO") {
    const effectiveColor =
      patch.color !== undefined
        ? patch.color
        : toNullableString((body as any).color ?? existing.color);

    if (!toNullableString(effectiveColor)) {
      return new Response(
        "Color es obligatorio cuando la técnica es FONDO_ENTERO",
        { status: 400 },
      );
    }
  }

  const effectiveProcess = normalizeOperationalProcess(
    patch.process !== undefined ? patch.process : existing.process,
  );
  if (patch.designType === undefined) {
    patch.designType = normalizeDesignType(effectiveProcess) as any;
  }
  if (patch.productionTechnique === undefined && body.productionTechnique !== undefined) {
    patch.productionTechnique = normalizeProductionTechnique(
      body.productionTechnique,
    ) as any;
  }
  const effectiveHasAdditions =
    patch.hasAdditions !== undefined
      ? Boolean(patch.hasAdditions)
      : Boolean(existing.hasAdditions);

  patch.process = effectiveProcess;
  patch.estimatedLeadDays = getItemLeadDays({
    orderType: resolveOrderTypeFromKind(kind),
    process: effectiveProcess,
    additions: effectiveHasAdditions ? [{}] : [],
  });

  if (body.status !== undefined) {
    const nextStatus = String(body.status ?? "")
      .trim()
      .toUpperCase();

    if (!orderItemStatuses.has(nextStatus)) {
      return new Response("invalid status", { status: 400 });
    }

    const role = getRoleFromRequest(request);
    const currentStatus = String(existing.status ?? "")
      .trim()
      .toUpperCase();

    if (!canRoleChangeStatus(role, currentStatus, nextStatus)) {
      return new Response("Forbidden", { status: 403 });
    }

    patch.status = nextStatus as any;
  }

  if (body.status === undefined && !quantityWasChanged) {
    const hasDesignFieldChange = [
      "name",
      "fabric",
      "observations",
      "imageUrl",
      "clothingImageOneUrl",
      "clothingImageTwoUrl",
      "logoImageUrl",
      "screenPrint",
      "screenPrintType",
      "embroidery",
      "buttonhole",
      "snap",
      "tag",
      "flag",
      "gender",
      "neckType",
      "cuffType",
      "sleeve",
      "color",
      "designType",
      "productionTechnique",
      "designerId",
      "discipline",
      "hasCordon",
      "cordonColor",
      "category",
      "labelBrand",
      "garmentType",
      "process",
      "hasAdditions",
      "additionEvidence",
      "requiresSocks",
    ].some((field) => body[field] !== undefined);

    const designChanged =
      hasDesignFieldChange ||
      (body.name !== undefined &&
        toNullableString(body.name) !== toNullableString(existing.name)) ||
      body.clothingImageOneUrl !== undefined ||
      body.clothingImageTwoUrl !== undefined ||
      body.logoImageUrl !== undefined;

    let tallaChanged = false;

    if (Array.isArray(body.packaging)) {
      const currentPackaging = await db
        .select({
          size: orderItemPackaging.size,
          quantity: orderItemPackaging.quantity,
        })
        .from(orderItemPackaging)
        .where(eq(orderItemPackaging.orderItemId, orderItemId));

      const normalizeRows = (
        rows: Array<{ size: unknown; quantity: unknown }>,
      ) =>
        rows
          .map((row) => ({
            size: String(row.size ?? "")
              .trim()
              .toUpperCase(),
            quantity: Number(row.quantity ?? 0),
          }))
          .filter((row) => row.size)
          .sort((a, b) => {
            if (a.size === b.size) return a.quantity - b.quantity;

            return a.size.localeCompare(b.size);
          });

      const left = normalizeRows(
        currentPackaging as Array<{ size: unknown; quantity: unknown }>,
      );
      const right = normalizeRows(
        body.packaging as Array<{ size: unknown; quantity: unknown }>,
      );

      tallaChanged = JSON.stringify(left) !== JSON.stringify(right);
    }

    const currentStatus = String(existing.status ?? "")
      .trim()
      .toUpperCase();

    if (
      shouldRouteDesignUpdateToApproval({
        orderStatus: orderRow?.orderStatus,
        quantityChanged: quantityWasChanged,
        requestedStatusProvided: body.status !== undefined,
        designChanged,
        tallaChanged,
      })
    ) {
      if (currentStatus !== ORDER_ITEM_STATUS.APROBACION_ACTUALIZACION) {
        patch.status = ORDER_ITEM_STATUS.APROBACION_ACTUALIZACION as any;
      }
    }
  }

  const updated = await db.transaction(async (tx) => {
    if (Object.keys(patch).length > 0) {
      await tx
        .update(orderItems)
        .set(patch)
        .where(eq(orderItems.id, orderItemId));
    }

    if (
      patch.status !== undefined &&
      patch.status !== null &&
      String(patch.status) !== String(existing.status ?? "")
    ) {
      await tx.insert(orderItemStatusHistory).values({
        orderItemId,
        status: patch.status as any,
        changedBy: employeeId,
      });
    }

    if (Array.isArray(body.packaging)) {
      await tx
        .delete(orderItemPackaging)
        .where(eq(orderItemPackaging.orderItemId, orderItemId));

      const packaging = body.packaging as any[];

      if (packaging.length > 0) {
        await tx.insert(orderItemPackaging).values(
          packaging.map((p) => ({
            orderItemId,
            mode: String(p.mode ?? "AGRUPADO"),
            size: String(p.size ?? ""),
            quantity:
              p.quantity === undefined ? null : toPositiveInt(p.quantity),
            personName: toNullableString(p.personName),
            personNumber: toNullableString(p.personNumber),
          })) as any,
        );
      }
    }

    if (Array.isArray(body.socks)) {
      await tx
        .delete(orderItemSocks)
        .where(eq(orderItemSocks.orderItemId, orderItemId));

      const socks = body.socks as any[];

      if (socks.length > 0) {
        await tx.insert(orderItemSocks).values(
          socks.map((s) => ({
            orderItemId,
            teamId: toNullableString(s.teamId),
            position: normalizePosition(s.position) as any,
            sockLength: normalizeSockLength(s.sockLength) as any,
            color: toNullableString(s.color),
            material: toNullableString(s.material),
            isDesigned: Boolean(s.isDesigned),
            size: String(s.size ?? ""),
            quantity:
              s.quantity === undefined ? null : toPositiveInt(s.quantity),
            description: toNullableString(s.description),
            imageUrl: toNullableString(s.imageUrl),
            logoImageUrl: toNullableString(s.logoImageUrl),
          })) as any,
        );
      }
    }

    if (Array.isArray(body.materials)) {
      await tx
        .delete(orderItemMaterials)
        .where(eq(orderItemMaterials.orderItemId, orderItemId));

      const materials = body.materials as any[];
      const inventoryIds = materials
        .map((m) => String(m.inventoryItemId ?? "").trim())
        .filter(Boolean);

      const existingInv = inventoryIds.length
        ? await tx
            .select({ id: inventoryItems.id })
            .from(inventoryItems)
            .where(inArray(inventoryItems.id, inventoryIds))
        : [];

      const existingSet = new Set(existingInv.map((r) => r.id));

      if (materials.length > 0) {
        await tx.insert(orderItemMaterials).values(
          materials
            .map((m) => ({
              orderItemId,
              inventoryItemId: String(m.inventoryItemId ?? "").trim(),
              quantity: toNullableNumericString(m.quantity),
              note: toNullableString(m.note),
            }))
            .filter((m) => existingSet.has(m.inventoryItemId)) as any,
        );
      }
    }

    if (Array.isArray(body.positions)) {
      await tx
        .delete(orderItemPositions)
        .where(eq(orderItemPositions.orderItemId, orderItemId));

      const positions = body.positions as any[];

      if (positions.length > 0) {
        await tx.insert(orderItemPositions).values(
          positions
            .map((p, idx) => ({
              orderItemId,
              position: normalizePosition(p.position) as any,
              quantity:
                p.quantity === undefined || p.quantity === null
                  ? 0
                  : Math.max(0, Number(p.quantity ?? 0)),
              color: toNullableString(p.color),
              sortOrder:
                p.sortOrder === undefined || p.sortOrder === null
                  ? idx + 1
                  : Math.max(1, Math.floor(Number(p.sortOrder ?? idx + 1))),
            }))
            .filter((p) => Boolean(p.position)) as any,
        );
      }
    }

    if (Array.isArray(body.teams)) {
      await tx
        .delete(orderItemTeams)
        .where(eq(orderItemTeams.orderItemId, orderItemId));

      const teams = body.teams as any[];

      if (teams.length > 0) {
        await tx.insert(orderItemTeams).values(
          teams
            .map((t, idx) => ({
              orderItemId,
              name: String(t.name ?? "").trim(),
              playerColor: toNullableString(t.playerColor),
              goalkeeperColor: toNullableString(t.goalkeeperColor),
              socksColor: toNullableString(t.socksColor),
              playerImageUrl: toNullableString(t.playerImageUrl),
              goalkeeperImageUrl: toNullableString(t.goalkeeperImageUrl),
              fullSetImageUrl: toNullableString(t.fullSetImageUrl),
              sortOrder:
                t.sortOrder === undefined || t.sortOrder === null
                  ? idx + 1
                  : Math.max(1, Math.floor(Number(t.sortOrder ?? idx + 1))),
            }))
            .filter((t) => t.name) as any,
        );
      }
    }

    if (Array.isArray(body.specialRequirements)) {
      await tx
        .delete(orderItemSpecialRequirements)
        .where(eq(orderItemSpecialRequirements.orderItemId, orderItemId));

      const specialRequirements = body.specialRequirements as any[];

      if (specialRequirements.length > 0) {
        await tx.insert(orderItemSpecialRequirements).values(
          specialRequirements.map((sr) => ({
            orderItemId,
            piece: toNullableString(sr.piece),
            fabric: toNullableString(sr.fabric),
            fabricColor: toNullableString(sr.fabricColor),
            hasReflectiveTape: Boolean(sr.hasReflectiveTape),
            reflectiveTapeLocation: toNullableString(sr.reflectiveTapeLocation),
            hasSideStripes: Boolean(sr.hasSideStripes),
            closureType: toNullableString(sr.closureType),
            closureQuantity: normalizeClosureQuantity(sr.closureQuantity),
            hasCordon: Boolean(sr.hasCordon),
            hasElastic: Boolean(sr.hasElastic),
            notes: toNullableString(sr.notes),
          })) as any,
        );
      }
    }

    const [res] = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.id, orderItemId))
      .limit(1);

    await recalcOrderTotal(tx, existing.orderId!);
    await syncOrderStatusFromItems(tx, existing.orderId!, employeeId);

    return res;
  });

  const nextStatus = patch.status !== undefined ? String(patch.status) : null;

  if (nextStatus && nextStatus !== String(existing.status ?? "")) {
    await createNotificationsForPermission("VER_DISEÑO", {
      title: "Cambio de estado",
      message: `Diseño ${existing.name ?? existing.id} pasó a ${nextStatus}.`,
      href: `/orders/${existing.orderId}/items/${existing.id}`,
    });
  }

  return Response.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "order-items:delete",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const orderItemId = String(id ?? "").trim();

  if (!orderItemId) return new Response("id required", { status: 400 });

  const [existing] = await db
    .select({ id: orderItems.id, orderId: orderItems.orderId })
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId))
    .limit(1);

  if (!existing) return new Response("Not found", { status: 404 });

  await db.transaction(async (tx) => {
    await tx
      .delete(orderItemMaterials)
      .where(eq(orderItemMaterials.orderItemId, orderItemId));
    await tx
      .delete(orderItemPackaging)
      .where(eq(orderItemPackaging.orderItemId, orderItemId));
    await tx
      .delete(orderItemSocks)
      .where(eq(orderItemSocks.orderItemId, orderItemId));
    await tx.delete(orderItems).where(eq(orderItems.id, orderItemId));

    await recalcOrderTotal(tx, existing.orderId!);
  });

  return new Response(null, { status: 204 });
}
