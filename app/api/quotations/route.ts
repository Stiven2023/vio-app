import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  employees,
  quotationItemAdditions,
  quotationItems,
  quotations,
  users,
} from "@/src/db/schema";
import { getUserIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { buildExpiryDateFromDelivery } from "@/src/utils/quotation-delivery";
import { rateLimit } from "@/src/utils/rate-limit";

function toDateOnlyLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isMissingPrefacturaColumnsError(error: unknown) {
  const code = String((error as any)?.code ?? "");
  const message = String((error as any)?.message ?? "").toLowerCase();

  if (code === "42703") {
    return (
      message.includes("prefactura_approved") ||
      message.includes("total_products")
    );
  }

  return false;
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

async function buildNextQuotationCode() {
  const [row] = await db
    .select({
      maxSuffix: sql<number>`max(nullif(substring(${quotations.quoteCode}, 4), '')::int)`,
    })
    .from(quotations)
    .where(sql`${quotations.quoteCode} like 'COT%'`);

  const next = (row?.maxSuffix ?? 10000) + 1;

  return `COT${String(next).padStart(5, "0")}`;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "quotations:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_COTIZACION");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const q = String(searchParams.get("q") ?? "").trim();
    const currency = String(searchParams.get("currency") ?? "").toUpperCase();
    const status = String(searchParams.get("status") ?? "active").toLowerCase();

    const filters = [] as Array<any>;

    if (status === "active") {
      filters.push(eq(quotations.isActive, true));
    } else if (status === "inactive") {
      filters.push(eq(quotations.isActive, false));
    }

    if (currency === "COP" || currency === "USD") {
      filters.push(eq(quotations.currency, currency));
    }

    if (q) {
      filters.push(
        or(
          ilike(quotations.quoteCode, `%${q}%`),
          ilike(clients.name, `%${q}%`),
          ilike(employees.name, `%${q}%`),
          ilike(users.email, `%${q}%`),
        ),
      );
    }

    const whereClause = filters.length > 0 ? and(...filters) : undefined;

    try {
      await db
        .update(quotations)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(quotations.isActive, true),
            eq(quotations.prefacturaApproved, false),
            sql`${quotations.expiryDate} is not null`,
            sql`${quotations.expiryDate} < current_date`,
          ),
        );
    } catch (error) {
      if (!isMissingPrefacturaColumnsError(error)) {
        throw error;
      }

      await db
        .update(quotations)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(quotations.isActive, true),
            sql`${quotations.expiryDate} is not null`,
            sql`${quotations.expiryDate} < current_date`,
          ),
        );
    }

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(quotations)
      .leftJoin(clients, eq(quotations.clientId, clients.id))
      .leftJoin(users, eq(quotations.sellerId, users.id))
      .leftJoin(employees, eq(employees.userId, users.id))
      .where(whereClause);

    let items: Array<{
      id: string;
      quoteCode: string;
      currency: string;
      total: string | null;
      totalProducts: string | null;
      isActive: boolean | null;
      prefacturaApproved: boolean | null;
      createdAt: Date | null;
      deliveryDate: string | null;
      expiryDate: string | null;
      clientId: string;
      sellerId: string;
      clientName: string | null;
      sellerName: string;
    }>;

    try {
      items = await db
        .select({
          id: quotations.id,
          quoteCode: quotations.quoteCode,
          currency: quotations.currency,
          total: quotations.total,
          totalProducts: quotations.totalProducts,
          isActive: quotations.isActive,
          prefacturaApproved: quotations.prefacturaApproved,
          createdAt: quotations.createdAt,
          deliveryDate: quotations.deliveryDate,
          expiryDate: quotations.expiryDate,
          clientId: quotations.clientId,
          sellerId: quotations.sellerId,
          clientName: clients.name,
          sellerName: sql<string>`coalesce(${employees.name}, ${users.email})`,
        })
        .from(quotations)
        .leftJoin(clients, eq(quotations.clientId, clients.id))
        .leftJoin(users, eq(quotations.sellerId, users.id))
        .leftJoin(employees, eq(employees.userId, users.id))
        .where(whereClause)
        .orderBy(desc(quotations.createdAt))
        .limit(pageSize)
        .offset(offset);
    } catch (error) {
      if (!isMissingPrefacturaColumnsError(error)) {
        throw error;
      }

      const legacyItems = await db
        .select({
          id: quotations.id,
          quoteCode: quotations.quoteCode,
          currency: quotations.currency,
          total: quotations.total,
          isActive: quotations.isActive,
          createdAt: quotations.createdAt,
          deliveryDate: quotations.deliveryDate,
          expiryDate: quotations.expiryDate,
          clientId: quotations.clientId,
          sellerId: quotations.sellerId,
          clientName: clients.name,
          sellerName: sql<string>`coalesce(${employees.name}, ${users.email})`,
        })
        .from(quotations)
        .leftJoin(clients, eq(quotations.clientId, clients.id))
        .leftJoin(users, eq(quotations.sellerId, users.id))
        .leftJoin(employees, eq(employees.userId, users.id))
        .where(whereClause)
        .orderBy(desc(quotations.createdAt))
        .limit(pageSize)
        .offset(offset);

      items = legacyItems.map((item) => ({
        ...item,
        totalProducts: null,
        prefacturaApproved: false,
      }));
    }

    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar cotizaciones", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "quotations:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_COTIZACION");

  if (forbidden) return forbidden;

  const body = await request.json();

  const clientId = String(body?.clientId ?? "").trim();
  const sellerIdFromBody = String(body?.sellerId ?? "").trim();
  const sellerIdFromSession = String(getUserIdFromRequest(request) ?? "").trim();
  const sellerId = sellerIdFromBody || sellerIdFromSession;

  if (!clientId) {
    return new Response("clientId required", { status: 400 });
  }

  if (!sellerId) {
    return new Response("sellerId required", { status: 400 });
  }

  const items = Array.isArray(body?.items) ? body.items : [];
  const totalProducts = calculateTotalProductsFromItems(items);
  const paymentTerms = String(body?.paymentTerms ?? "").toUpperCase();
  const autoExpiryDate = buildExpiryDateFromDelivery(toDateOnlyLocal(new Date()), 30);

  if (items.length === 0) {
    return new Response("items required", { status: 400 });
  }

  let validatedPromissoryNoteNumber: string | null = null;
  if (paymentTerms === "CREDITO") {
    const [client] = await db
      .select({
        hasCredit: clients.hasCredit,
        promissoryNoteNumber: clients.promissoryNoteNumber,
      })
      .from(clients)
      .where(eq(clients.id, clientId))
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
    const quoteCode = await buildNextQuotationCode();

    const created = await db.transaction(async (tx) => {
      const [header] = await tx
        .insert(quotations)
        .values({
          quoteCode,
          clientId,
          sellerId,
          clientPriceType: body?.clientPriceType
            ? String(body.clientPriceType)
            : null,
          documentType: body?.documentType
            ? (String(body.documentType) as "P" | "R")
            : "P",
          currency: body?.currency ? String(body.currency) : "COP",
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
          isActive: true,
          updatedAt: new Date(),
        })
        .returning();

      for (const rawItem of items) {
        const productId = String(rawItem?.productId ?? "").trim();
        if (!productId) {
          throw new Error("item productId required");
        }

        const rawOrderType = String(rawItem?.orderType ?? "NORMAL").toUpperCase();
        const orderType = rawOrderType === "BODEGA" ? "REPOSICION" : rawOrderType;

        const [savedItem] = await tx
          .insert(quotationItems)
          .values({
            quotationId: header.id,
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

    return Response.json({ id: created.id, quoteCode: created.quoteCode }, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo crear la cotización", { status: 500 });
  }
}
