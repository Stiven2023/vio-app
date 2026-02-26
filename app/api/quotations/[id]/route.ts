import { eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  quotationItemAdditions,
  quotationItems,
  quotations,
} from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { buildExpiryDateFromDelivery } from "@/src/utils/quotation-delivery";
import { rateLimit } from "@/src/utils/rate-limit";

function toDateOnlyLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toNumericString(value: unknown) {
  if (value === null || value === undefined || value === "") return "0";
  const n = Number(value);

  if (Number.isNaN(n)) return "0";

  return n.toFixed(2);
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

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "quotations:get:id",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_COTIZACION");

  if (forbidden) return forbidden;

  try {
    const [quotation] = await db
      .select()
      .from(quotations)
      .where(eq(quotations.id, String(params.id)))
      .limit(1);

    if (!quotation) {
      return new Response("Cotización no encontrada", { status: 404 });
    }

    const items = await db
      .select()
      .from(quotationItems)
      .where(eq(quotationItems.quotationId, quotation.id));

    const itemIds = items.map((item) => item.id);
    const additions = itemIds.length
      ? await db
          .select()
          .from(quotationItemAdditions)
          .where(inArray(quotationItemAdditions.quotationItemId, itemIds))
      : [];

    const additionsByItemId = new Map<string, typeof additions>();
    for (const add of additions) {
      const key = String(add.quotationItemId);
      const current = additionsByItemId.get(key) ?? [];
      current.push(add);
      additionsByItemId.set(key, current);
    }

    const mappedItems = items.map((item) => {
      const rawOrderType = String(item.orderType ?? "").toUpperCase();
      const rawProcess = String(item.negotiation ?? "").toUpperCase();
      const orderType = [
        "NORMAL",
        "COMPLETACION",
        "REFERENTE",
        "REPOSICION",
        "MUESTRA",
        "OBSEQUIO",
      ].includes(rawOrderType)
        ? rawOrderType
        : rawOrderType === "BODEGA"
          ? "REPOSICION"
          : rawProcess === "MUESTRA"
            ? "MUESTRA"
            : "NORMAL";

      return {
        id: item.id,
        productId: item.productId,
        orderType,
        process: ["PRODUCCION", "BODEGA", "COMPRAS"].includes(rawProcess)
          ? rawProcess
          : "PRODUCCION",
        quantity: Number(item.quantity ?? 0),
        unitPrice: Number(item.unitPrice ?? 0),
        discount: Number(item.discount ?? 0),
        referenceOrderCode: item.orderCodeReference,
        referenceDesign: item.designNumber,
        additions: (additionsByItemId.get(item.id) ?? []).map((add) => ({
          id: add.additionId,
          quantity: Number(add.quantity ?? 0),
          unitPrice: Number(add.unitPrice ?? 0),
        })),
      };
    });

    return Response.json({ ...quotation, items: mappedItems });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar la cotización", { status: 500 });
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "quotations:put:id",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_COTIZACION");

  if (forbidden) return forbidden;

  const body = await request.json();
  const quotationId = String(params.id ?? "").trim();

  if (!quotationId) {
    return new Response("id required", { status: 400 });
  }

  const items = Array.isArray(body?.items) ? body.items : [];
  const totalProducts = calculateTotalProductsFromItems(items);
  const paymentTerms = String(body?.paymentTerms ?? "").toUpperCase();
  const autoExpiryDate = buildExpiryDateFromDelivery(toDateOnlyLocal(new Date()), 30);

  if (items.length === 0) {
    return new Response("items required", { status: 400 });
  }

  const [currentQuote] = await db
    .select({ clientId: quotations.clientId })
    .from(quotations)
    .where(eq(quotations.id, quotationId))
    .limit(1);

  if (!currentQuote) {
    return new Response("Cotización no encontrada", { status: 404 });
  }

  const effectiveClientId = body?.clientId
    ? String(body.clientId)
    : String(currentQuote.clientId);

  let validatedPromissoryNoteNumber: string | null = null;
  if (paymentTerms === "CREDITO") {
    const [client] = await db
      .select({
        hasCredit: clients.hasCredit,
        promissoryNoteNumber: clients.promissoryNoteNumber,
      })
      .from(clients)
      .where(eq(clients.id, effectiveClientId))
      .limit(1);

    if (!client?.hasCredit) {
      return new Response("client without active credit", { status: 400 });
    }

    const clientPromissory = String(client.promissoryNoteNumber ?? "").trim();
    if (!clientPromissory) {
      return new Response("client without promissory note number", { status: 400 });
    }

    validatedPromissoryNoteNumber = clientPromissory;
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const [header] = await tx
        .update(quotations)
        .set({
          clientId: body?.clientId ? String(body.clientId) : undefined,
          sellerId: body?.sellerId ? String(body.sellerId) : undefined,
          clientPriceType: body?.clientPriceType
            ? String(body.clientPriceType)
            : null,
          documentType: body?.documentType
            ? (String(body.documentType) as "P" | "R")
            : undefined,
          currency: body?.currency ? String(body.currency) : undefined,
          deliveryDate: null,
          expiryDate: autoExpiryDate,
          paymentTerms: body?.paymentTerms ? String(body.paymentTerms) : null,
          promissoryNoteNumber:
            paymentTerms === "CREDITO"
              ? validatedPromissoryNoteNumber
              : null,
          totalProducts,
          subtotal: toNumericString(body?.subtotal),
          iva: toNumericString(body?.iva),
          shippingEnabled: Boolean(body?.shippingEnabled),
          shippingFee: toNumericString(body?.shippingFee),
          insuranceEnabled: Boolean(body?.insuranceEnabled),
          insuranceFee: toNumericString(body?.insuranceFee),
          total: toNumericString(body?.total),
          advancePayment: toNumericString(body?.advancePayment),
          updatedAt: new Date(),
        })
        .where(eq(quotations.id, quotationId))
        .returning();

      if (!header) {
        return null;
      }

      await tx.delete(quotationItems).where(eq(quotationItems.quotationId, quotationId));

      for (const rawItem of items) {
        const productId = String(rawItem?.productId ?? "").trim();
        if (!productId) continue;

        const rawOrderType = String(rawItem?.orderType ?? "NORMAL").toUpperCase();
        const orderType = rawOrderType === "BODEGA" ? "REPOSICION" : rawOrderType;

        const [savedItem] = await tx
          .insert(quotationItems)
          .values({
            quotationId,
            productId,
            orderType,
            negotiation: rawItem?.process
              ? String(rawItem.process)
              : rawItem?.negotiation
                ? String(rawItem.negotiation)
              : null,
            quantity: toNumericString(rawItem?.quantity),
            unitPrice: toNumericString(rawItem?.unitPrice),
            discount: toNumericString(rawItem?.discount),
            orderCodeReference: rawItem?.orderCodeReference
              ? String(rawItem.orderCodeReference)
              : null,
            designNumber: rawItem?.designNumber
              ? String(rawItem.designNumber)
              : null,
          })
          .returning();

        const additions = Array.isArray(rawItem?.additions) ? rawItem.additions : [];

        if (additions.length > 0) {
          await tx.insert(quotationItemAdditions).values(
            additions
              .map((add: any) => {
                const additionId = String(add?.id ?? "").trim();
                if (!additionId) return null;

                return {
                  quotationItemId: savedItem.id,
                  additionId,
                  quantity: toNumericString(add?.quantity),
                  unitPrice: toNumericString(add?.unitPrice),
                };
              })
              .filter(Boolean) as {
              quotationItemId: string;
              additionId: string;
              quantity: string;
              unitPrice: string;
            }[],
          );
        }
      }

      return header;
    });

    if (!updated) {
      return new Response("Cotización no encontrada", { status: 404 });
    }

    return Response.json({ id: updated.id, quoteCode: updated.quoteCode });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo actualizar la cotización", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "quotations:delete:id",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_COTIZACION");

  if (forbidden) return forbidden;

  const quotationId = String(params.id ?? "").trim();

  if (!quotationId) {
    return new Response("id required", { status: 400 });
  }

  try {
    const deleted = await db
      .delete(quotations)
      .where(eq(quotations.id, quotationId))
      .returning();

    if (deleted.length === 0) {
      return new Response("Cotización no encontrada", { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo eliminar la cotización", { status: 500 });
  }
}
