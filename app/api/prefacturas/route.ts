import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  additions,
  clients,
  employees,
  orderItemAdditions,
  orderItems,
  orders,
  orderStatusHistory,
  prefacturas,
  products,
  quotations,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { getItemLeadDays } from "@/src/utils/quotation-delivery";
import { rateLimit } from "@/src/utils/rate-limit";

async function resolveAdvisorFilter(request: Request) {
  const role = getRoleFromRequest(request);

  if (role !== "ASESOR") return null;

  const employeeId = getEmployeeIdFromRequest(request);

  if (!employeeId) return "forbidden";

  return employeeId;
}

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

function toPositiveInt(v: unknown) {
  const n = Number(String(v));
  if (!Number.isFinite(n)) return 1;
  const normalized = Math.round(n);
  return normalized > 0 ? normalized : 1;
}

function toNumericString(value: unknown) {
  if (value === null || value === undefined || value === "") return "0.00";
  const n = Number(value);

  if (Number.isNaN(n)) return "0.00";

  return n.toFixed(2);
}

function isUniqueViolation(error: unknown) {
  return (error as any)?.code === "23505";
}

function calculateTotalProductsFromItems(items: any[]) {
  const totalProducts = items.reduce((acc, rawItem) => {
    const quantity = Number(rawItem?.quantity ?? 0);
    const unitPrice = Number(rawItem?.unitPrice ?? 0);
    const discount = Number(rawItem?.discount ?? 0);

    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return acc;

    const lineSubtotal = quantity * unitPrice;
    const discountAmount = lineSubtotal * (Number.isFinite(discount) ? discount / 100 : 0);
    const lineTotal = lineSubtotal - discountAmount;

    return acc + (Number.isFinite(lineTotal) ? lineTotal : 0);
  }, 0);

  return toNumericString(totalProducts);
}

type OrderTypeCode = "VN" | "VI" | "VT" | "VW";

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

async function generateOrderCode(tx: any, type: OrderTypeCode) {
  const prefix = `${type}-`;
  const seqLen = type === "VI" ? 4 : 6;
  const pattern = `(?i)^${type}-(?:[0-9]{8}-)?([0-9]+)$`;

  const [row] = await tx
    .select({
      maxSeq: sql<number>`max((substring(${orders.orderCode} from ${pattern})::int))`,
    })
    .from(orders)
    .where(ilike(orders.orderCode, `${type}-%`))
    .limit(1);

  const maxSeq = Number(row?.maxSeq ?? 0);
  const nextSeq = Number.isFinite(maxSeq) ? maxSeq + 1 : 1;

  return `${prefix}${String(nextSeq).padStart(seqLen, "0")}`;
}

async function generatePrefacturaCode(tx: any) {
  const [row] = await tx
    .select({
      maxSuffix: sql<number>`max((substring(${prefacturas.prefacturaCode} from '(?i)^PRE([0-9]+)$')::int))`,
    })
    .from(prefacturas)
    .where(ilike(prefacturas.prefacturaCode, "PRE%"))
    .limit(1);

  const next = (row?.maxSuffix ?? 10000) + 1;
  return `PRE${String(next).padStart(5, "0")}`;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "prefacturas:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");
  if (forbidden) return forbidden;

  const advisorScope = await resolveAdvisorFilter(request);
  if (advisorScope === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const q = String(searchParams.get("q") ?? "").trim();
    const status = String(searchParams.get("status") ?? "all").trim().toUpperCase();
    const type = String(searchParams.get("type") ?? "all").trim().toUpperCase();
    const orderStatus = String(searchParams.get("orderStatus") ?? "all").trim().toUpperCase();

    const filters = [] as Array<any>;

    if (status && status !== "ALL") {
      filters.push(eq(prefacturas.status, status));
    }

    if (type === "VN" || type === "VI" || type === "VT" || type === "VW") {
      filters.push(eq(orders.type, type as any));
    }

    if (orderStatus && orderStatus !== "ALL") {
      filters.push(eq(orders.status, orderStatus as any));
    }

    if (advisorScope) {
      filters.push(eq(orders.createdBy, advisorScope));
    }

    if (q) {
      filters.push(
        or(
          ilike(prefacturas.prefacturaCode, `%${q}%`),
          ilike(quotations.quoteCode, `%${q}%`),
          ilike(orders.orderCode, `%${q}%`),
          ilike(orders.orderName, `%${q}%`),
          ilike(clients.name, `%${q}%`),
        ),
      );
    }

    const whereClause = filters.length ? and(...filters) : undefined;

    const [{ total }] = await db
      .select({ total: sql<number>`count(distinct ${prefacturas.id})::int` })
      .from(prefacturas)
      .leftJoin(quotations, eq(prefacturas.quotationId, quotations.id))
      .leftJoin(orders, eq(prefacturas.orderId, orders.id))
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .where(whereClause);

    const items = await db
      .select({
        id: prefacturas.id,
        prefacturaCode: prefacturas.prefacturaCode,
        quotationId: prefacturas.quotationId,
        quoteCode: quotations.quoteCode,
        orderId: prefacturas.orderId,
        orderCode: orders.orderCode,
        orderName: orders.orderName,
        orderType: orders.type,
        status: prefacturas.status,
        totalProducts: prefacturas.totalProducts,
        subtotal: prefacturas.subtotal,
        total: prefacturas.total,
        clientName: sql<string | null>`coalesce(${clients.name}, (select c2.name from clients c2 where c2.id = ${quotations.clientId}))`,
        approvedAt: prefacturas.approvedAt,
        createdAt: prefacturas.createdAt,
      })
      .from(prefacturas)
      .leftJoin(quotations, eq(prefacturas.quotationId, quotations.id))
      .leftJoin(orders, eq(prefacturas.orderId, orders.id))
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .where(whereClause)
      .orderBy(desc(prefacturas.createdAt))
      .limit(pageSize)
      .offset(offset);

    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudieron consultar prefacturas", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "prefacturas:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PEDIDO");
  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const quotationIdRaw = String(body?.quotationId ?? "").trim();
    const quotationCodeRaw = String(body?.quotationCode ?? "").trim();
    const orderName = String(body?.orderName ?? "").trim();
    const orderType = String(body?.orderType ?? "").trim().toUpperCase();

    let quotationId = quotationIdRaw;

    if (!quotationId && quotationCodeRaw) {
      const [quote] = await db
        .select({ id: quotations.id })
        .from(quotations)
        .where(eq(quotations.quoteCode, quotationCodeRaw))
        .limit(1);

      quotationId = String(quote?.id ?? "").trim();
    }

    if (!quotationId) {
      const clientId = String(body?.clientId ?? "").trim();
      const currency =
        String(body?.currency ?? "COP").trim().toUpperCase() === "USD" ? "USD" : "COP";
      const items = Array.isArray(body?.items) ? body.items : [];

      if (!clientId) {
        return new Response("clientId required", { status: 400 });
      }

      if (items.length === 0) {
        return new Response("items required", { status: 400 });
      }

      const normalizedOrderType: OrderTypeCode =
        orderType === "VI" || orderType === "VT" || orderType === "VW" ? orderType : "VN";

      const computedTotalProducts = calculateTotalProductsFromItems(items);
      const subtotal = toNumericString(body?.subtotal);
      const total = toNumericString(body?.total);
      const shippingEnabled = Boolean(body?.shippingEnabled);
      const shippingFee = shippingEnabled ? toNumericString(body?.shippingFee) : "0.00";

      const employeeId = await resolveEmployeeId(request);

      const created = await db.transaction(async (tx) => {
        let createdOrder: {
          id: string;
          orderCode: string;
          orderName: string | null;
        } | null = null;

        for (let attempt = 0; attempt < 5; attempt++) {
          const orderCode = await generateOrderCode(tx, normalizedOrderType);

          try {
            const [savedOrder] = await tx
              .insert(orders)
              .values({
                orderCode,
                orderName: orderName || `Pedido ${clientId.slice(0, 8)}`,
                clientId,
                type: normalizedOrderType,
                kind: "NUEVO" as any,
                status: "PENDIENTE" as any,
                total,
                ivaEnabled: String(body?.documentType ?? "P") === "P",
                discount: "0",
                currency,
                shippingFee,
                createdBy: employeeId,
              })
              .returning({
                id: orders.id,
                orderCode: orders.orderCode,
                orderName: orders.orderName,
              });

            if (!savedOrder) {
              throw new Error("No se pudo crear pedido");
            }

            createdOrder = savedOrder;
            break;
          } catch (error) {
            if (!isUniqueViolation(error) || attempt === 4) throw error;
          }
        }

        if (!createdOrder) {
          throw new Error("No se pudo crear pedido");
        }

        await tx.insert(orderStatusHistory).values({
          orderId: createdOrder.id,
          status: "PENDIENTE" as any,
          changedBy: employeeId,
        });

        const productIds = items
          .map((raw: any) => String(raw?.productId ?? "").trim())
          .filter(Boolean);

        const additionIds = items
          .flatMap((raw: any) =>
            Array.isArray(raw?.additions)
              ? raw.additions.map((add: any) => String(add?.id ?? "").trim())
              : [],
          )
          .filter(Boolean);

        const productRows = productIds.length
          ? await tx
              .select({ id: products.id, name: products.name })
              .from(products)
              .where(inArray(products.id, productIds))
          : [];

        const additionRows = additionIds.length
          ? await tx
              .select({ id: additions.id, name: additions.name })
              .from(additions)
              .where(inArray(additions.id, additionIds))
          : [];

        const productNameById = new Map(productRows.map((row) => [String(row.id), row.name]));
        const additionNameById = new Map(additionRows.map((row) => [String(row.id), row.name]));

        const conditionalTypes = new Set(["COMPLETACION", "REFERENTE", "REPOSICION"]);
        const referencedItems = items.filter((raw: any) => {
          const type = String(raw?.orderType ?? "").trim().toUpperCase();
          const code = String(raw?.orderCodeReference ?? "").trim();
          return conditionalTypes.has(type) && Boolean(code);
        });

        const referencedOrderCodes = Array.from(
          new Set(
            referencedItems
              .map((raw: any) => String(raw?.orderCodeReference ?? "").trim())
              .filter(Boolean),
          ),
        ) as string[];

        const referencedOrders = referencedOrderCodes.length
          ? await tx
              .select({ id: orders.id, orderCode: orders.orderCode })
              .from(orders)
              .where(inArray(orders.orderCode, referencedOrderCodes))
          : [];

        const referencedOrderIdByCode = new Map(
          referencedOrders.map((row) => [String(row.orderCode), String(row.id)]),
        );

        const referencedOrderIds = Array.from(
          new Set(referencedOrders.map((row) => String(row.id))),
        );

        const referencedDesignItems = referencedOrderIds.length
          ? await tx
              .select({
                id: orderItems.id,
                orderId: orderItems.orderId,
                productId: orderItems.productId,
                name: orderItems.name,
                quantity: orderItems.quantity,
                unitPrice: orderItems.unitPrice,
                totalPrice: orderItems.totalPrice,
                hasAdditions: orderItems.hasAdditions,
                additionEvidence: orderItems.additionEvidence,
                observations: orderItems.observations,
                fabric: orderItems.fabric,
                imageUrl: orderItems.imageUrl,
                screenPrint: orderItems.screenPrint,
                embroidery: orderItems.embroidery,
                buttonhole: orderItems.buttonhole,
                snap: orderItems.snap,
                tag: orderItems.tag,
                flag: orderItems.flag,
                gender: orderItems.gender,
                process: orderItems.process,
                estimatedLeadDays: orderItems.estimatedLeadDays,
                neckType: orderItems.neckType,
                sleeve: orderItems.sleeve,
                color: orderItems.color,
                requiresSocks: orderItems.requiresSocks,
                isActive: orderItems.isActive,
                manufacturingId: orderItems.manufacturingId,
                status: orderItems.status,
                requiresRevision: orderItems.requiresRevision,
              })
              .from(orderItems)
              .where(inArray(orderItems.orderId, referencedOrderIds as any))
          : [];

        const referencedDesignsByOrderId = new Map<string, typeof referencedDesignItems>();
        for (const design of referencedDesignItems) {
          const key = String(design.orderId ?? "");
          const current = referencedDesignsByOrderId.get(key) ?? [];
          current.push(design);
          referencedDesignsByOrderId.set(key, current);
        }

        const designValues: Array<typeof orderItems.$inferInsert> = [];
        const additionsQueue: Array<{
          itemIndex: number;
          additionId: string;
          quantity: string;
          unitPrice: string;
        }> = [];

        for (let index = 0; index < items.length; index++) {
          const item = items[index];
          const productId = String(item?.productId ?? "").trim();
          if (!productId) {
            throw new Error("item productId required");
          }

          const orderTypeNormalized = String(item?.orderType ?? "").trim().toUpperCase();
          const referenceOrderCode = String(item?.orderCodeReference ?? "").trim();
          const referenceDesign = String(item?.designNumber ?? "").trim();
          const referencedOrderId = referenceOrderCode
            ? referencedOrderIdByCode.get(referenceOrderCode)
            : undefined;
          const sourceCandidates = referencedOrderId
            ? referencedDesignsByOrderId.get(referencedOrderId) ?? []
            : [];
          const sourceDesign = conditionalTypes.has(orderTypeNormalized)
            ? sourceCandidates.find((candidate) => {
                const designRef = referenceDesign.toUpperCase();
                return (
                  String(candidate.id ?? "") === referenceDesign ||
                  String(candidate.manufacturingId ?? "").trim().toUpperCase() === designRef ||
                  String(candidate.name ?? "").trim().toUpperCase() === designRef
                );
              })
            : null;

          const qty = toPositiveInt(item?.quantity);
          const unitPrice = asNumber(item?.unitPrice);
          const discount = Math.min(100, Math.max(0, asNumber(item?.discount)));
          const subtotalLine = unitPrice * qty;
          const lineTotal = subtotalLine - subtotalLine * (discount / 100);
          const itemAdditions = Array.isArray(item?.additions) ? item.additions : [];
          const process = ["PRODUCCION", "BODEGA", "COMPRAS"].includes(
            String(item?.process ?? "").toUpperCase(),
          )
            ? String(item.process).toUpperCase()
            : "PRODUCCION";
          const leadDays = getItemLeadDays({
            orderType: String(item?.orderType ?? "NORMAL"),
            process,
            additions: itemAdditions.map((add: any) => ({
              additionName: additionNameById.get(String(add?.id ?? "")) ?? "Adición",
            })),
          });
          const additionEvidence = itemAdditions.length
            ? itemAdditions
                .map((add: any) => additionNameById.get(String(add?.id ?? "")) ?? "Adición")
                .join(", ")
            : null;

          designValues.push({
            orderId: createdOrder.id,
            productId: sourceDesign?.productId ?? productId,
            additionId: null,
            name:
              sourceDesign?.name ??
              productNameById.get(productId) ??
              "Producto",
            quantity: sourceDesign?.quantity ?? qty,
            unitPrice: sourceDesign?.unitPrice ?? String(unitPrice),
            totalPrice: sourceDesign?.totalPrice ?? String(lineTotal),
            hasAdditions: sourceDesign
              ? Boolean(sourceDesign.hasAdditions)
              : itemAdditions.length > 0,
            additionEvidence: sourceDesign?.additionEvidence ?? additionEvidence,
            observations: sourceDesign?.observations ?? `Demora estimada: ${leadDays} días`,
            fabric: sourceDesign?.fabric ?? null,
            imageUrl: sourceDesign?.imageUrl ?? null,
            screenPrint: Boolean(sourceDesign?.screenPrint ?? false),
            embroidery: Boolean(sourceDesign?.embroidery ?? false),
            buttonhole: Boolean(sourceDesign?.buttonhole ?? false),
            snap: Boolean(sourceDesign?.snap ?? false),
            tag: Boolean(sourceDesign?.tag ?? false),
            flag: Boolean(sourceDesign?.flag ?? false),
            gender: sourceDesign?.gender ?? null,
            process: sourceDesign?.process ?? process,
            estimatedLeadDays: sourceDesign?.estimatedLeadDays ?? leadDays,
            neckType: sourceDesign?.neckType ?? null,
            sleeve: sourceDesign?.sleeve ?? null,
            color: sourceDesign?.color ?? null,
            requiresSocks: Boolean(sourceDesign?.requiresSocks ?? false),
            isActive: sourceDesign?.isActive ?? true,
            manufacturingId: sourceDesign?.manufacturingId ?? null,
            status: sourceDesign?.status ?? ("PENDIENTE" as any),
            requiresRevision: Boolean(sourceDesign?.requiresRevision ?? false),
          });

          for (const add of itemAdditions) {
            const additionId = String(add?.id ?? "").trim();
            if (!additionId) continue;

            additionsQueue.push({
              itemIndex: index,
              additionId,
              quantity: String(toPositiveInt(add?.quantity)),
              unitPrice: String(asNumber(add?.unitPrice)),
            });
          }
        }

        const insertedItems = designValues.length
          ? await tx
              .insert(orderItems)
              .values(designValues as any)
              .returning({ id: orderItems.id })
          : [];

        if (additionsQueue.length > 0) {
          const additionRowsToInsert: Array<typeof orderItemAdditions.$inferInsert> = [];

          for (const additionRow of additionsQueue) {
            const mappedItem = insertedItems[additionRow.itemIndex];
            if (!mappedItem?.id) continue;

            additionRowsToInsert.push({
              orderItemId: mappedItem.id,
              additionId: additionRow.additionId,
              quantity: additionRow.quantity,
              unitPrice: additionRow.unitPrice,
            });
          }

          if (additionRowsToInsert.length > 0) {
            await tx.insert(orderItemAdditions).values(additionRowsToInsert as any);
          }
        }

        let createdPrefactura: { id: string; prefacturaCode: string } | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const prefacturaCode = await generatePrefacturaCode(tx);

          try {
            const [savedPrefactura] = await tx
              .insert(prefacturas)
              .values({
                prefacturaCode,
                quotationId: null,
                orderId: createdOrder.id,
                status: "PENDIENTE_CONTABILIDAD",
                totalProducts: computedTotalProducts,
                subtotal,
                total,
                approvedAt: new Date(),
              })
              .returning({
                id: prefacturas.id,
                prefacturaCode: prefacturas.prefacturaCode,
              });

            createdPrefactura = savedPrefactura ?? null;
            break;
          } catch (error) {
            if (!isUniqueViolation(error) || attempt === 4) throw error;
          }
        }

        if (!createdPrefactura) {
          throw new Error("No se pudo crear prefactura");
        }

        return {
          prefactura: {
            id: createdPrefactura.id,
            prefacturaCode: createdPrefactura.prefacturaCode,
            status: "PENDIENTE_CONTABILIDAD",
          },
          order: {
            id: createdOrder.id,
            orderCode: createdOrder.orderCode,
            orderName: createdOrder.orderName,
          },
          reused: false,
          direct: true,
        };
      });

      return Response.json(created, { status: 201 });
    }

    const origin = new URL(request.url).origin;
    const proxyResponse = await fetch(`${origin}/api/quotations/${quotationId}/prefactura`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        orderName,
        orderType:
          orderType === "VI" || orderType === "VT" || orderType === "VW"
            ? orderType
            : "VN",
      }),
      cache: "no-store",
    });

    const contentType = proxyResponse.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await proxyResponse.json();
      return Response.json(payload, { status: proxyResponse.status });
    }

    const text = await proxyResponse.text();
    return new Response(text, { status: proxyResponse.status });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo crear prefactura", { status: 500 });
  }
}
