import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  employees,
  inventoryItems,
  orderItemMaterials,
  orderItemPositions,
  orderItemPackaging,
  orderItemSpecialRequirements,
  orderItemSocks,
  orderItemStatusHistory,
  orderItemTeams,
  orderItems,
  orders,
  prefacturas,
  products,
  quotationItems,
  quotations,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { createNotificationsForPermission } from "@/src/utils/notifications";
import { getOrderDesignQuantityLimitError } from "@/src/utils/order-item-quantity-limit";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { getLatestUsdCopRate } from "@/src/utils/exchange-rate";
import { getItemLeadDays } from "@/src/utils/quotation-delivery";

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

const GARMENT_TYPES = new Set([
  "JUGADOR",
  "ARQUERO",
  "CAPITAN",
  "JUEZ",
  "ENTRENADOR",
  "LIBERO",
  "OBJETO",
]);

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
  if (quantity <= 499) return row.priceCopR1 || row.priceCopBase;
  if (quantity <= 1000)
    return row.priceCopR2 || row.priceCopR1 || row.priceCopBase;

  return row.priceCopR3 || row.priceCopR2 || row.priceCopR1 || row.priceCopBase;
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

  if (clientPriceType === "VIOMAR") {
    return (
      row.priceViomar ||
      row.priceCopBase ||
      row.priceCopR1 ||
      pickCopScaleByQuantity(row, quantity)
    );
  }

  if (clientPriceType === "COLANTA") {
    return (
      row.priceColanta ||
      row.priceCopBase ||
      row.priceCopR1 ||
      pickCopScaleByQuantity(row, quantity)
    );
  }

  if (clientPriceType === "MAYORISTA") {
    return (
      row.priceMayorista ||
      row.priceCopBase ||
      row.priceCopR1 ||
      pickCopScaleByQuantity(row, quantity)
    );
  }

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

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "order-items:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePagination(searchParams);
  const orderId = String(searchParams.get("orderId") ?? "").trim();
  const hasAdditionsFilter = String(searchParams.get("hasAdditions") ?? "")
    .trim()
    .toLowerCase();

  if (!orderId) {
    return new Response("orderId required", { status: 400 });
  }

  const advisorForbidden = await assertAdvisorOrderAccess(request, orderId);

  if (advisorForbidden) return advisorForbidden;

  const whereClauses = [eq(orderItems.orderId, orderId)];

  if (hasAdditionsFilter === "with") {
    whereClauses.push(eq(orderItems.hasAdditions, true));
  } else if (hasAdditionsFilter === "without") {
    whereClauses.push(eq(orderItems.hasAdditions, false));
  }

  const where =
    whereClauses.length > 1 ? and(...whereClauses) : whereClauses[0];

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(orderItems)
    .where(where);

  const items = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      name: orderItems.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
      hasAdditions: orderItems.hasAdditions,
      additionEvidence: orderItems.additionEvidence,
      imageUrl: orderItems.imageUrl,
      status: orderItems.status,
      lastStatusAt: sql<string | null>`(
        select oish.created_at
        from order_item_status_history oish
        where oish.order_item_id = ${sql.raw('"order_items"."id"')}
        order by oish.created_at desc
        limit 1
      )`,
      lastStatusBy: sql<string | null>`(
        select e.name
        from order_item_status_history oish
        left join employees e on e.id = oish.changed_by
        where oish.order_item_id = ${sql.raw('"order_items"."id"')}
        order by oish.created_at desc
        limit 1
      )`,
      createdAt: orderItems.createdAt,
      confectionistName: sql<string | null>`(
        select c.name
        from order_item_confection oic
        join confectionists c on c.id = oic.confectionist_id
        where oic.order_item_id = ${sql.raw('"order_items"."id"')}
          and oic.finished_at is null
        order by oic.assigned_at desc
        limit 1
      )`,
    })
    .from(orderItems)
    .where(where)
    .orderBy(asc(orderItems.createdAt))
    .limit(pageSize)
    .offset(offset);

  const hasNextPage = offset + items.length < total;

  return Response.json({ items, page, pageSize, total, hasNextPage });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "order-items:post",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const body = (await request.json()) as any;

  const orderId = String(body.orderId ?? "").trim();

  if (!orderId) return new Response("orderId required", { status: 400 });

  const advisorForbidden = await assertAdvisorOrderAccess(request, orderId);

  if (advisorForbidden) return advisorForbidden;

  const qty = toPositiveInt(body.quantity);

  if (!qty) return new Response("quantity must be positive", { status: 400 });

  const groupedPackagingTotal = sumGroupedPackagingQuantity(body.packaging);

  const positionsValidationError = validatePositionsBusiness(
    body.positions,
    body.orderConfigurationMode,
  );

  if (positionsValidationError) {
    return new Response(positionsValidationError, { status: 400 });
  }

  if (groupedPackagingTotal > qty) {
    return new Response(
      `La curva no puede superar la cantidad del diseño (${qty}).`,
      { status: 400 },
    );
  }

  const employeeId = await resolveEmployeeId(request);
  const latestUsdCopRate = await getLatestUsdCopRate();
  const garmentType = normalizeGarmentType(body.garmentType);

  if (!garmentType) {
    return new Response("garmentType inválido", { status: 400 });
  }

  const clothingImageOneUrl = toNullableString(body.clothingImageOneUrl);
  const clothingImageTwoUrl = toNullableString(body.clothingImageTwoUrl);
  const logoImageUrl = toNullableString(body.logoImageUrl);

  if (!logoImageUrl) {
    return new Response("logoImageUrl es obligatorio", { status: 400 });
  }

  let created: typeof orderItems.$inferSelect | undefined;

  try {
    created = await db.transaction(async (tx) => {
      const [orderRow] = await tx
        .select({
          kind: orders.kind,
          currency: orders.currency,
          clientPriceType: sql<string>`coalesce(cast(${prefacturas.clientPriceType} as text), cast(${quotations.clientPriceType} as text), 'VIOMAR')`,
        })
        .from(orders)
        .leftJoin(prefacturas, eq(prefacturas.orderId, orders.id))
        .leftJoin(quotations, eq(prefacturas.quotationId, quotations.id))
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!orderRow) throw new Error("order not found");

      // COMPLETACION: no se permite agregar nuevos diseños
      if (orderRow.kind === "COMPLETACION") {
        throw new Error(
          "No se pueden agregar diseños en pedidos de completación",
        );
      }

      const quantityLimitError = await getOrderDesignQuantityLimitError(tx, {
        orderId,
        nextItemQuantity: qty,
      });

      if (quantityLimitError) {
        throw new Error(
          `La suma de diseños del pedido no puede superar ${quantityLimitError.agreedUnits} unidades acordadas. Disponibles: ${quantityLimitError.availableUnits}.`,
        );
      }

      const productId = toNullableString(body.productId);

      if (!productId) {
        throw new Error("productId required");
      }

      const [productRow] = await tx
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!productRow || productRow.isActive === false) {
        throw new Error("producto requerido");
      }

      const [prefacturaLink] = await tx
        .select({ quotationId: prefacturas.quotationId })
        .from(prefacturas)
        .where(eq(prefacturas.orderId, orderId))
        .limit(1);

      if (prefacturaLink?.quotationId) {
        const allowedRows = await tx
          .select({ productId: quotationItems.productId })
          .from(quotationItems)
          .where(eq(quotationItems.quotationId, prefacturaLink.quotationId));

        const allowedProductIds = new Set(
          allowedRows.map((row) => String(row.productId ?? "").trim()),
        );

        if (allowedProductIds.size > 0 && !allowedProductIds.has(productId)) {
          throw new Error(
            "El producto seleccionado no está habilitado en la prefactura del pedido",
          );
        }
      }

      const resolvedUnitPrice = resolveUnitPriceByRule({
        currency: orderRow.currency,
        clientPriceType: orderRow.clientPriceType,
        quantity: qty,
        row: productRow,
        manualUnitPrice: body.unitPrice,
        usdCopEffectiveRate: latestUsdCopRate?.effectiveRate ?? null,
      });

      if (!resolvedUnitPrice) {
        throw new Error("No hay precio aplicable para este cliente y cantidad");
      }

      const unitPrice = Math.max(0, asNumber(resolvedUnitPrice));
      const additionEvidence = toNullableString(body.additionEvidence);
      const hasAdditions =
        Boolean(body.hasAdditions) || Boolean(additionEvidence);
      const normalizedProcess = normalizeOperationalProcess(body.process);
      const normalizedDesignType = normalizeDesignType(
        body.designType ?? normalizedProcess,
      );
      const normalizedProductionTechnique = normalizeProductionTechnique(
        body.productionTechnique,
      );
      const normalizedScreenPrintType = normalizeScreenPrintType(
        body.screenPrintType,
      );
      const effectiveScreenPrint = normalizedScreenPrintType
        ? true
        : Boolean(body.screenPrint ?? false);
      const effectiveScreenPrintType = normalizedScreenPrintType
        ? normalizedScreenPrintType
        : effectiveScreenPrint
          ? "DTF"
          : null;

      if (normalizedProductionTechnique === "FONDO_ENTERO") {
        const hasColor = Boolean(String(body.color ?? "").trim());

        if (!hasColor) {
          throw new Error("Color es obligatorio cuando la técnica es FONDO_ENTERO");
        }
      }
      const estimatedLeadDays = getItemLeadDays({
        orderType: resolveOrderTypeFromKind(orderRow.kind),
        process: normalizedProcess,
        additions: hasAdditions ? [{}] : [],
      });

      const [oi] = await tx
        .insert(orderItems)
        .values({
          orderId,
          productId,
          name: toNullableString(body.name),
          garmentType,
          quantity: qty,
          unitPrice: String(unitPrice),
          totalPrice: String(unitPrice * qty),
          hasAdditions,
          additionEvidence: hasAdditions ? additionEvidence : null,
          observations: toNullableString(body.observations),
          fabric: toNullableString(body.fabric),
          imageUrl: clothingImageOneUrl ?? toNullableString(body.imageUrl),
          clothingImageOneUrl,
          clothingImageTwoUrl,
          logoImageUrl,
          screenPrint: effectiveScreenPrint,
          screenPrintType: effectiveScreenPrintType,
          embroidery: Boolean(body.embroidery ?? false),
          buttonhole: Boolean(body.buttonhole ?? false),
          snap: Boolean(body.snap ?? false),
          tag: Boolean(body.tag ?? false),
          flag: Boolean(body.flag ?? false),
          gender: toNullableString(body.gender),
          designType: normalizedDesignType as any,
          productionTechnique: normalizedProductionTechnique as any,
          process: normalizedProcess,
          designerId: toNullableString(body.designerId),
          discipline: toNullableString(body.discipline),
          hasCordon: Boolean(body.hasCordon),
          cordonColor: toNullableString(body.cordonColor),
          category: toNullableString(body.category),
          labelBrand: toNullableString(body.labelBrand),
          estimatedLeadDays,
          neckType: toNullableString(body.neckType),
          cuffType: toNullableString(body.cuffType),
          sleeve: toNullableString(body.sleeve),
          color: toNullableString(body.color),
          requiresSocks: Boolean(body.requiresSocks ?? false),
          isActive: body.isActive === undefined ? true : Boolean(body.isActive),
          manufacturingId: toNullableString(body.manufacturingId),
          status: "PENDIENTE" as any,
          requiresRevision: false,
        } as any)
        .returning();

      const orderItemId = oi!.id;

      await tx.insert(orderItemStatusHistory).values({
        orderItemId,
        status: (oi as any)?.status ?? "PENDIENTE",
        changedBy: employeeId,
      });

      const packaging = Array.isArray(body.packaging) ? body.packaging : [];

      if (packaging.length > 0) {
        await tx.insert(orderItemPackaging).values(
          packaging.map((p: any) => ({
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

      const socks = Array.isArray(body.socks) ? body.socks : [];

      if (socks.length > 0) {
        await tx.insert(orderItemSocks).values(
          socks.map((s: any) => ({
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

      const materials = Array.isArray(body.materials) ? body.materials : [];

      if (materials.length > 0) {
        const inventoryIds = materials
          .map((m: any) => String(m.inventoryItemId ?? "").trim())
          .filter(Boolean);

        const existingInv = inventoryIds.length
          ? await tx
              .select({ id: inventoryItems.id })
              .from(inventoryItems)
              .where(inArray(inventoryItems.id, inventoryIds))
          : [];

        const existingSet = new Set(existingInv.map((r) => r.id));

        await tx.insert(orderItemMaterials).values(
          materials
            .map((m: any) => ({
              orderItemId,
              inventoryItemId: String(m.inventoryItemId ?? "").trim(),
              quantity: toNullableNumericString(m.quantity),
              note: toNullableString(m.note),
            }))
            .filter((m: any) => existingSet.has(m.inventoryItemId)) as any,
        );
      }

      const positions = Array.isArray(body.positions) ? body.positions : [];

      if (positions.length > 0) {
        await tx.insert(orderItemPositions).values(
          positions
            .map((p: any, idx: number) => ({
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
            .filter((p: any) => Boolean(p.position)) as any,
        );
      }

      const teams = Array.isArray(body.teams) ? body.teams : [];

      if (teams.length > 0) {
        await tx.insert(orderItemTeams).values(
          teams
            .map((t: any, idx: number) => ({
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
            .filter((t: any) => t.name) as any,
        );
      }

      const specialRequirements = Array.isArray(body.specialRequirements)
        ? body.specialRequirements
        : [];

      if (specialRequirements.length > 0) {
        await tx.insert(orderItemSpecialRequirements).values(
          specialRequirements.map((sr: any) => ({
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

      await recalcOrderTotal(tx, orderId);

      return oi;
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear el diseño";

    if (
      message.includes("required") ||
      message.includes("vigente") ||
      message.includes("aplicable") ||
      message.includes("completación") ||
      message.includes("Ya existe") ||
      message.includes("obligatorio")
    ) {
      return new Response(message, { status: 400 });
    }

    return new Response("No se pudo crear el diseño", { status: 500 });
  }

  await createNotificationsForPermission("VER_DISEÑO", {
    title: "Diseño creado",
    message: `Se creó el diseño ${created?.name ?? "(sin nombre)"}.`,
    href: `/orders/${orderId}/items/${created?.id}`,
  });

  return Response.json(created, { status: 201 });
}
