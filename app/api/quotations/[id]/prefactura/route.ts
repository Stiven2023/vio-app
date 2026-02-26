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
import { rateLimit } from "@/src/utils/rate-limit";

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

async function generateOrderCode(tx: any, type: "VN" | "VI") {
  const prefix = `${type}-`;
  const seqLen = type === "VN" ? 6 : 4;
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

  const forbiddenQuotation = await requirePermission(request, "EDITAR_COTIZACION");
  if (forbiddenQuotation) return forbiddenQuotation;

  const forbiddenOrder = await requirePermission(request, "CREAR_PEDIDO");
  if (forbiddenOrder) return forbiddenOrder;

  const quotationId = String(params.id ?? "").trim();
  if (!quotationId) return new Response("id required", { status: 400 });

  let orderNameFromBody: string | null = null;
  let orderTypeFromBody: "VN" | "VI" | null = null;
  try {
    const body = await request.json();
    const rawOrderName = String(body?.orderName ?? "").trim();
    const rawOrderType = String(body?.orderType ?? "").trim().toUpperCase();

    orderNameFromBody = rawOrderName ? rawOrderName : null;
    orderTypeFromBody = rawOrderType === "VI" ? "VI" : rawOrderType === "VN" ? "VN" : null;
  } catch {
    orderNameFromBody = null;
    orderTypeFromBody = null;
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
        String(quotation.currency ?? "COP").toUpperCase() === "USD" ? "VI" : "VN";
      const orderType = orderTypeFromBody ?? orderTypeByQuotation;
      const orderName = orderNameFromBody ?? `Pedido ${quotation.quoteCode}`;

      let createdOrder: {
        id: string;
        orderCode: string;
        orderName: string | null;
      } | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        const orderCode = await generateOrderCode(tx, orderType as "VN" | "VI");

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
              ivaEnabled: String(quotation.documentType ?? "P") === "P",
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
          quantity: quotationItems.quantity,
          unitPrice: quotationItems.unitPrice,
          discount: quotationItems.discount,
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
            .leftJoin(additions, eq(quotationItemAdditions.additionId, additions.id))
            .where(inArray(quotationItemAdditions.quotationItemId, quoteItemIds))
        : [];

      const additionsByItem = new Map<string, typeof quoteAdditions>();
      for (const add of quoteAdditions) {
        const key = String(add.quotationItemId);
        const current = additionsByItem.get(key) ?? [];
        current.push(add);
        additionsByItem.set(key, current);
      }

      const designValues: Array<typeof orderItems.$inferInsert> = [];
      const additionsQueue: Array<{
        quotationItemId: string;
        additionId: string;
        quantity: string;
        unitPrice: string;
      }> = [];

      for (const item of quoteItems) {
        const qty = toPositiveInt(item.quantity);
        const unitPrice = asNumber(item.unitPrice);
        const discount = Math.min(100, Math.max(0, asNumber(item.discount)));
        const subtotal = unitPrice * qty;
        const lineTotal = subtotal - subtotal * (discount / 100);
        const adds = additionsByItem.get(item.id) ?? [];
        const additionEvidence = adds.length
          ? adds
              .map((add) => String(add.additionName ?? "Adición").trim())
              .filter(Boolean)
              .join(", ")
          : null;

        designValues.push({
          orderId: createdOrder.id,
          productId: item.productId,
          additionId: null,
          name: item.productName ?? "Producto",
          quantity: qty,
          unitPrice: String(unitPrice),
          totalPrice: String(lineTotal),
          hasAdditions: adds.length > 0,
          additionEvidence,
          status: "PENDIENTE" as any,
          requiresRevision: false,
          isActive: true,
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
              String(row.productId ?? "") === String(quoteItem.productId ?? "") &&
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
          const orderItemId = insertedByQuotationItem.get(entry.quotationItemId);
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

            const legacyAdditionItems: Array<typeof orderItems.$inferInsert> = [];
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
                totalPrice: String(asNumber(row.quantity) * asNumber(row.unitPrice)),
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
