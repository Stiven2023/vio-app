import { eq, inArray, ilike, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  additions,
  employees,
  orderItemAdditions,
  orderItems,
  orders,
  orderStatusHistory,
  prefacturas,
  quotationItemAdditions,
  quotationItems,
  quotations,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { getItemLeadDays } from "@/src/utils/quotation-delivery";
import { rateLimit } from "@/src/utils/rate-limit";

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

function toNumericString(value: unknown) {
  const n = Number(value);

  if (!Number.isFinite(n)) return "0.00";

  return n.toFixed(2);
}

function normalizeTaxZone(value: unknown) {
  const normalized = String(value ?? "CONTINENTAL")
    .trim()
    .toUpperCase();

  if (
    normalized === "FREE_ZONE" ||
    normalized === "SAN_ANDRES" ||
    normalized === "SPECIAL_REGIME"
  ) {
    return normalized as "FREE_ZONE" | "SAN_ANDRES" | "SPECIAL_REGIME";
  }

  return "CONTINENTAL" as const;
}

function toPositiveInt(v: unknown) {
  const n = Number(String(v));

  if (!Number.isFinite(n)) return 1;
  const normalized = Math.round(n);

  return normalized > 0 ? normalized : 1;
}

function isUniqueViolation(error: unknown) {
  return (error as any)?.code === "23505";
}

function dbCode(error: unknown) {
  return String((error as any)?.code ?? "").trim();
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

type OrderTypeCode = "VN" | "VI" | "VT" | "VW";

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

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "quotations:prefactura:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbiddenQuotation = await requirePermission(
    request,
    "EDITAR_COTIZACION",
  );

  if (forbiddenQuotation) return forbiddenQuotation;

  const forbiddenOrder = await requirePermission(request, "CREAR_PEDIDO");

  if (forbiddenOrder) return forbiddenOrder;

  const quotationId = String(params.id ?? "").trim();

  if (!quotationId) return new Response("id required", { status: 400 });

  let orderNameFromBody: string | null = null;
  let orderTypeFromBody: OrderTypeCode | null = null;
  let prefacturaFiscalInput: Record<string, unknown> = {};

  try {
    const body = await request.json();
    const rawOrderName = String(body?.orderName ?? "").trim();
    const rawOrderType = String(body?.orderType ?? "")
      .trim()
      .toUpperCase();

    orderNameFromBody = rawOrderName ? rawOrderName : null;
    orderTypeFromBody =
      rawOrderType === "VI" || rawOrderType === "VT" || rawOrderType === "VW"
        ? (rawOrderType as OrderTypeCode)
        : rawOrderType === "VN"
          ? "VN"
          : null;
    prefacturaFiscalInput = {
      municipalityFiscalSnapshot: body?.municipalityFiscalSnapshot,
      taxZoneSnapshot: body?.taxZoneSnapshot,
      withholdingTaxRate: body?.withholdingTaxRate,
      withholdingIcaRate: body?.withholdingIcaRate,
      withholdingIvaRate: body?.withholdingIvaRate,
      withholdingTaxAmount: body?.withholdingTaxAmount,
      withholdingIcaAmount: body?.withholdingIcaAmount,
      withholdingIvaAmount: body?.withholdingIvaAmount,
      totalAfterWithholdings: body?.totalAfterWithholdings,
    };
  } catch {
    orderNameFromBody = null;
    orderTypeFromBody = null;
    prefacturaFiscalInput = {};
  }

  try {
    const employeeId = await resolveEmployeeId(request);

    const result = await db.transaction(async (tx) => {
      const [quotation] = await tx
        .select()
        .from(quotations)
        .where(eq(quotations.id, quotationId))
        .limit(1);

      if (!quotation) {
        throw new Error("Cotización no encontrada");
      }

      const [existingPrefactura] = await tx
        .select({
          id: prefacturas.id,
          prefacturaCode: prefacturas.prefacturaCode,
          orderId: prefacturas.orderId,
        })
        .from(prefacturas)
        .where(eq(prefacturas.quotationId, quotationId))
        .limit(1);

      if (existingPrefactura?.orderId) {
        const [linkedOrder] = await tx
          .select({
            id: orders.id,
            orderCode: orders.orderCode,
            orderName: orders.orderName,
          })
          .from(orders)
          .where(eq(orders.id, String(existingPrefactura.orderId)))
          .limit(1);

        if (orderNameFromBody && linkedOrder?.id) {
          const updateData: Partial<typeof orders.$inferInsert> = {
            orderName: orderNameFromBody,
            shippingFee: quotation.shippingEnabled
              ? String(quotation.shippingFee ?? "0")
              : "0",
            total: String(quotation.total ?? "0"),
          };

          if (orderTypeFromBody) {
            updateData.type = orderTypeFromBody as any;
          }

          await tx
            .update(orders)
            .set(updateData)
            .where(eq(orders.id, linkedOrder.id));
        }

        await tx
          .update(prefacturas)
          .set({
            municipalityFiscalSnapshot:
              prefacturaFiscalInput.municipalityFiscalSnapshot
                ? String(
                    prefacturaFiscalInput.municipalityFiscalSnapshot,
                  ).trim()
                : String(quotation.municipalityFiscalSnapshot ?? "").trim() ||
                  null,
            taxZoneSnapshot: normalizeTaxZone(
              prefacturaFiscalInput.taxZoneSnapshot ??
                quotation.taxZoneSnapshot,
            ),
            withholdingTaxRate: toNumericString(
              prefacturaFiscalInput.withholdingTaxRate ??
                quotation.withholdingTaxRate,
            ),
            withholdingIcaRate: toNumericString(
              prefacturaFiscalInput.withholdingIcaRate ??
                quotation.withholdingIcaRate,
            ),
            withholdingIvaRate: toNumericString(
              prefacturaFiscalInput.withholdingIvaRate ??
                quotation.withholdingIvaRate,
            ),
            withholdingTaxAmount: toNumericString(
              prefacturaFiscalInput.withholdingTaxAmount ??
                quotation.withholdingTaxAmount,
            ),
            withholdingIcaAmount: toNumericString(
              prefacturaFiscalInput.withholdingIcaAmount ??
                quotation.withholdingIcaAmount,
            ),
            withholdingIvaAmount: toNumericString(
              prefacturaFiscalInput.withholdingIvaAmount ??
                quotation.withholdingIvaAmount,
            ),
            totalAfterWithholdings: toNumericString(
              prefacturaFiscalInput.totalAfterWithholdings ??
                asNumber(quotation.total) -
                  asNumber(quotation.withholdingTaxAmount) -
                  asNumber(quotation.withholdingIcaAmount) -
                  asNumber(quotation.withholdingIvaAmount),
            ),
          })
          .where(eq(prefacturas.id, existingPrefactura.id));

        await tx
          .update(quotations)
          .set({
            prefacturaApproved: false,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(quotations.id, quotationId));

        return {
          prefactura: {
            id: existingPrefactura.id,
            prefacturaCode: existingPrefactura.prefacturaCode,
            status: "PENDIENTE_CONTABILIDAD",
          },
          order: linkedOrder
            ? {
                id: linkedOrder.id,
                orderCode: linkedOrder.orderCode,
                orderName: orderNameFromBody ?? linkedOrder.orderName,
              }
            : null,
          reused: true,
        };
      }

      const orderTypeByQuotation =
        String(quotation.currency ?? "COP").toUpperCase() === "USD"
          ? "VI"
          : "VN";
      const orderType = (orderTypeFromBody ??
        orderTypeByQuotation) as OrderTypeCode;
      const orderName = orderNameFromBody ?? `Pedido ${quotation.quoteCode}`;

      let createdOrder: {
        id: string;
        orderCode: string;
        orderName: string | null;
      } | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        const orderCode = await generateOrderCode(tx, orderType);

        try {
          const [savedOrder] = await tx
            .insert(orders)
            .values({
              orderCode,
              orderName,
              clientId: quotation.clientId,
              type: orderType as any,
              kind: "NUEVO" as any,
              status: "PENDIENTE" as any,
              total: String(quotation.total ?? "0"),
              ivaEnabled: String(quotation.documentType ?? "F") === "F",
              discount: "0",
              currency: String(quotation.currency ?? "COP"),
              shippingFee: quotation.shippingEnabled
                ? String(quotation.shippingFee ?? "0")
                : "0",
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

      const quoteItems = await tx
        .select({
          id: quotationItems.id,
          productId: quotationItems.productId,
          orderType: quotationItems.orderType,
          process: quotationItems.negotiation,
          quantity: quotationItems.quantity,
          unitPrice: quotationItems.unitPrice,
          discount: quotationItems.discount,
          orderCodeReference: quotationItems.orderCodeReference,
          designNumber: quotationItems.designNumber,
          productName: sql<string>`(select p.name from products p where p.id = ${quotationItems.productId})`,
        })
        .from(quotationItems)
        .where(eq(quotationItems.quotationId, quotationId));

      const quoteItemIds = quoteItems.map((item) => item.id);

      const quoteAdditions = quoteItemIds.length
        ? await tx
            .select({
              quotationItemId: quotationItemAdditions.quotationItemId,
              additionId: quotationItemAdditions.additionId,
              quantity: quotationItemAdditions.quantity,
              unitPrice: quotationItemAdditions.unitPrice,
              additionName: additions.name,
            })
            .from(quotationItemAdditions)
            .leftJoin(
              additions,
              eq(quotationItemAdditions.additionId, additions.id),
            )
            .where(
              inArray(quotationItemAdditions.quotationItemId, quoteItemIds),
            )
        : [];

      const additionsByItem = new Map<string, typeof quoteAdditions>();

      for (const add of quoteAdditions) {
        const key = String(add.quotationItemId);
        const current = additionsByItem.get(key) ?? [];

        current.push(add);
        additionsByItem.set(key, current);
      }

      const conditionalTypes = new Set([
        "COMPLETACION",
        "REFERENTE",
        "REPOSICION",
      ]);
      const referencedQuoteItems = quoteItems.filter((item) => {
        const type = String(item.orderType ?? "").toUpperCase();
        const code = String(item.orderCodeReference ?? "").trim();

        return conditionalTypes.has(type) && Boolean(code);
      });

      const referencedOrderCodes = Array.from(
        new Set(
          referencedQuoteItems
            .map((item) => String(item.orderCodeReference ?? "").trim())
            .filter(Boolean),
        ),
      );

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

      const referencedDesignsByOrderId = new Map<
        string,
        typeof referencedDesignItems
      >();

      for (const design of referencedDesignItems) {
        const key = String(design.orderId ?? "");
        const current = referencedDesignsByOrderId.get(key) ?? [];

        current.push(design);
        referencedDesignsByOrderId.set(key, current);
      }

      const designValues: Array<typeof orderItems.$inferInsert> = [];
      const additionsQueue: Array<{
        quotationItemId: string;
        additionId: string;
        quantity: string;
        unitPrice: string;
      }> = [];

      for (const item of quoteItems) {
        const orderTypeNormalized = String(item.orderType ?? "")
          .trim()
          .toUpperCase();
        const referenceOrderCode = String(item.orderCodeReference ?? "").trim();
        const referenceDesign = String(item.designNumber ?? "").trim();
        const referencedOrderId = referenceOrderCode
          ? referencedOrderIdByCode.get(referenceOrderCode)
          : undefined;
        const sourceCandidates = referencedOrderId
          ? (referencedDesignsByOrderId.get(referencedOrderId) ?? [])
          : [];
        const sourceDesign = conditionalTypes.has(orderTypeNormalized)
          ? sourceCandidates.find((candidate) => {
              const designNumber = referenceDesign.toUpperCase();

              return (
                String(candidate.id ?? "") === referenceDesign ||
                String(candidate.manufacturingId ?? "")
                  .trim()
                  .toUpperCase() === designNumber ||
                String(candidate.name ?? "")
                  .trim()
                  .toUpperCase() === designNumber
              );
            })
          : null;

        const qty = toPositiveInt(item.quantity);
        const unitPrice = asNumber(item.unitPrice);
        const discount = Math.min(100, Math.max(0, asNumber(item.discount)));
        const subtotal = unitPrice * qty;
        const lineTotal = subtotal - subtotal * (discount / 100);
        const adds = additionsByItem.get(item.id) ?? [];
        const process = ["PRODUCCION", "BODEGA", "COMPRAS"].includes(
          String(item.process ?? "").toUpperCase(),
        )
          ? String(item.process ?? "").toUpperCase()
          : "PRODUCCION";
        const estimatedLeadDays = getItemLeadDays({
          orderType: item.orderType,
          process,
          additions: adds,
        });
        const additionEvidence = adds.length
          ? adds
              .map((add) => String(add.additionName ?? "Adición").trim())
              .filter(Boolean)
              .join(", ")
          : null;

        designValues.push({
          orderId: createdOrder.id,
          productId: sourceDesign?.productId ?? item.productId,
          additionId: null,
          name: sourceDesign?.name ?? item.productName ?? "Producto",
          quantity: sourceDesign?.quantity ?? qty,
          unitPrice: sourceDesign?.unitPrice ?? String(unitPrice),
          totalPrice: sourceDesign?.totalPrice ?? String(lineTotal),
          hasAdditions: sourceDesign
            ? Boolean(sourceDesign.hasAdditions)
            : adds.length > 0,
          additionEvidence: sourceDesign?.additionEvidence ?? additionEvidence,
          observations:
            sourceDesign?.observations ??
            `Demora estimada: ${estimatedLeadDays} días`,
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
          estimatedLeadDays:
            sourceDesign?.estimatedLeadDays ?? estimatedLeadDays,
          neckType: sourceDesign?.neckType ?? null,
          sleeve: sourceDesign?.sleeve ?? null,
          color: sourceDesign?.color ?? null,
          requiresSocks: Boolean(sourceDesign?.requiresSocks ?? false),
          isActive: sourceDesign?.isActive ?? true,
          manufacturingId: sourceDesign?.manufacturingId ?? null,
          status: sourceDesign?.status ?? ("PENDIENTE" as any),
          requiresRevision: Boolean(sourceDesign?.requiresRevision ?? false),
        });

        for (const add of adds) {
          const addQty = toPositiveInt(add.quantity);
          const addUnitPrice = asNumber(add.unitPrice);

          if (add.additionId) {
            additionsQueue.push({
              quotationItemId: item.id,
              additionId: String(add.additionId),
              quantity: String(addQty),
              unitPrice: String(addUnitPrice),
            });
          }
        }
      }

      // Auto-set delivery date from the longest estimated lead time in the order.
      {
        const maxLeadDays = designValues.reduce((max, item) => {
          const days = Number(item.estimatedLeadDays ?? 0);

          return Number.isFinite(days) ? Math.max(max, days) : max;
        }, 0);

        if (maxLeadDays > 0) {
          const deliveryDeadline = new Date();

          deliveryDeadline.setDate(deliveryDeadline.getDate() + maxLeadDays);
          const autoDeliveryDate = deliveryDeadline.toISOString().slice(0, 10);

          await tx
            .update(orders)
            .set({ deliveryDate: autoDeliveryDate } as any)
            .where(eq(orders.id, createdOrder.id));
        }
      }

      const insertedByQuotationItem = new Map<string, string>();

      if (designValues.length > 0) {
        const insertedDesigns = await tx
          .insert(orderItems)
          .values(designValues as any)
          .returning({
            id: orderItems.id,
            productId: orderItems.productId,
            orderId: orderItems.orderId,
          });

        const used = new Set<string>();

        for (const quoteItem of quoteItems) {
          const match = insertedDesigns.find(
            (row) =>
              String(row.orderId ?? "") === createdOrder.id &&
              String(row.productId ?? "") ===
                String(quoteItem.productId ?? "") &&
              !used.has(String(row.id)),
          );

          if (match?.id) {
            insertedByQuotationItem.set(String(quoteItem.id), String(match.id));
            used.add(String(match.id));
          }
        }
      }

      if (additionsQueue.length > 0) {
        const additionRows: Array<typeof orderItemAdditions.$inferInsert> = [];

        for (const entry of additionsQueue) {
          const orderItemId = insertedByQuotationItem.get(
            entry.quotationItemId,
          );

          if (!orderItemId) continue;

          additionRows.push({
            orderItemId,
            additionId: entry.additionId,
            quantity: entry.quantity,
            unitPrice: entry.unitPrice,
          });
        }

        if (additionRows.length > 0) {
          try {
            await tx.insert(orderItemAdditions).values(additionRows as any);
          } catch (error) {
            const code = dbCode(error);

            if (code !== "42P01") {
              throw error;
            }

            const legacyAdditionItems: Array<typeof orderItems.$inferInsert> =
              [];

            for (const row of additionRows) {
              const [baseItem] = await tx
                .select({
                  orderId: orderItems.orderId,
                  quantity: orderItems.quantity,
                })
                .from(orderItems)
                .where(eq(orderItems.id, row.orderItemId))
                .limit(1);

              if (!baseItem?.orderId) continue;

              legacyAdditionItems.push({
                orderId: String(baseItem.orderId),
                productId: null,
                additionId: String(row.additionId),
                name: "Adición",
                quantity: toPositiveInt(row.quantity),
                unitPrice: String(row.unitPrice),
                totalPrice: String(
                  asNumber(row.quantity) * asNumber(row.unitPrice),
                ),
                status: "PENDIENTE" as any,
                requiresRevision: false,
                isActive: true,
              });
            }

            if (legacyAdditionItems.length > 0) {
              await tx.insert(orderItems).values(legacyAdditionItems as any);
            }
          }
        }
      }

      let createdPrefactura: {
        id: string;
        prefacturaCode: string;
      } | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        const prefacturaCode = await generatePrefacturaCode(tx);

        try {
          let savedPrefactura: {
            id: string;
            prefacturaCode: string;
          } | null = null;

          try {
            const [inserted] = await tx
              .insert(prefacturas)
              .values({
                prefacturaCode,
                quotationId,
                orderId: createdOrder.id,
                status: "PENDIENTE_CONTABILIDAD",
                totalProducts: String(quotation.totalProducts ?? "0"),
                subtotal: String(quotation.subtotal ?? "0"),
                total: String(quotation.total ?? "0"),
                municipalityFiscalSnapshot:
                  prefacturaFiscalInput.municipalityFiscalSnapshot
                    ? String(
                        prefacturaFiscalInput.municipalityFiscalSnapshot,
                      ).trim()
                    : String(
                        quotation.municipalityFiscalSnapshot ?? "",
                      ).trim() || null,
                taxZoneSnapshot: normalizeTaxZone(
                  prefacturaFiscalInput.taxZoneSnapshot ??
                    quotation.taxZoneSnapshot,
                ),
                withholdingTaxRate: toNumericString(
                  prefacturaFiscalInput.withholdingTaxRate ??
                    quotation.withholdingTaxRate,
                ),
                withholdingIcaRate: toNumericString(
                  prefacturaFiscalInput.withholdingIcaRate ??
                    quotation.withholdingIcaRate,
                ),
                withholdingIvaRate: toNumericString(
                  prefacturaFiscalInput.withholdingIvaRate ??
                    quotation.withholdingIvaRate,
                ),
                withholdingTaxAmount: toNumericString(
                  prefacturaFiscalInput.withholdingTaxAmount ??
                    quotation.withholdingTaxAmount,
                ),
                withholdingIcaAmount: toNumericString(
                  prefacturaFiscalInput.withholdingIcaAmount ??
                    quotation.withholdingIcaAmount,
                ),
                withholdingIvaAmount: toNumericString(
                  prefacturaFiscalInput.withholdingIvaAmount ??
                    quotation.withholdingIvaAmount,
                ),
                totalAfterWithholdings: toNumericString(
                  prefacturaFiscalInput.totalAfterWithholdings ??
                    asNumber(quotation.total) -
                      asNumber(quotation.withholdingTaxAmount) -
                      asNumber(quotation.withholdingIcaAmount) -
                      asNumber(quotation.withholdingIvaAmount),
                ),
                approvedAt: new Date(),
              })
              .returning({
                id: prefacturas.id,
                prefacturaCode: prefacturas.prefacturaCode,
              });

            savedPrefactura = inserted ?? null;
          } catch (error) {
            if (dbCode(error) !== "22001") {
              throw error;
            }

            const [insertedLegacy] = await tx
              .insert(prefacturas)
              .values({
                prefacturaCode,
                quotationId,
                orderId: createdOrder.id,
                status: "PENDIENTE",
                totalProducts: String(quotation.totalProducts ?? "0"),
                subtotal: String(quotation.subtotal ?? "0"),
                total: String(quotation.total ?? "0"),
                approvedAt: new Date(),
              })
              .returning({
                id: prefacturas.id,
                prefacturaCode: prefacturas.prefacturaCode,
              });

            savedPrefactura = insertedLegacy ?? null;
          }

          if (!savedPrefactura) {
            throw new Error("No se pudo crear prefactura");
          }

          createdPrefactura = savedPrefactura;
          break;
        } catch (error) {
          if (!isUniqueViolation(error) || attempt === 4) throw error;
        }
      }

      if (!createdPrefactura) {
        throw new Error("No se pudo crear prefactura");
      }

      await tx
        .update(quotations)
        .set({
          prefacturaApproved: false,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(quotations.id, quotationId));

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
      };
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    if ((error as Error)?.message === "Cotización no encontrada") {
      return new Response("Cotización no encontrada", { status: 404 });
    }

    console.error("[quotations/:id/prefactura]", error);

    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo convertir la cotización a prefactura", {
      status: 500,
    });
  }
}
