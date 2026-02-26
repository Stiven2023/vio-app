import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/src/db";
import { additions, clients, products } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "quotations:options:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_COTIZACION");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const catalogType = String(searchParams.get("catalogType") ?? "NACIONAL").toUpperCase();

    const clientItems = await db
      .select({
        id: clients.id,
        name: clients.name,
        clientCode: clients.clientCode,
        clientType: clients.clientType,
        identificationType: clients.identificationType,
        email: clients.email,
        identification: clients.identification,
        dv: clients.dv,
        address: clients.address,
        country: clients.country,
        city: clients.city,
        postalCode: clients.postalCode,
        contactName: clients.contactName,
        contactPhone: clients.fullMobile,
        contactPhoneAlt: clients.mobile,
        contactPhoneLandline: clients.landline,
        priceClientType: clients.priceClientType,
        isActive: clients.isActive,
        hasCredit: clients.hasCredit,
        promissoryNoteNumber: clients.promissoryNoteNumber,
      })
      .from(clients)
      .where(eq(clients.isActive, true));

    const normalizedClients = clientItems.map((client) => ({
      id: client.id,
      name: client.name,
      clientCode: client.clientCode,
      clientType: client.clientType,
      identificationType: client.identificationType,
      email: client.email,
      identification: client.identification,
      dv: client.dv,
      address: client.address,
      country: client.country,
      city: client.city,
      postalCode: client.postalCode,
      contactName: client.contactName,
      contactPhone:
        client.contactPhone ||
        client.contactPhoneAlt ||
        client.contactPhoneLandline ||
        null,
      priceClientType: client.priceClientType,
      isActive: client.isActive,
      hasCredit: client.hasCredit,
      promissoryNoteNumber: client.promissoryNoteNumber,
    }));

    const productBaseFilters = [eq(products.isActive, true)];

    if (catalogType === "INTERNACIONAL") {
      productBaseFilters.push(isNotNull(products.priceCopInternational));
      productBaseFilters.push(isNotNull(products.priceUSD));
    } else {
      productBaseFilters.push(isNotNull(products.priceCopR1));
      productBaseFilters.push(isNotNull(products.priceCopR2));
      productBaseFilters.push(isNotNull(products.priceCopR3));
      productBaseFilters.push(isNotNull(products.priceColanta));
      productBaseFilters.push(isNotNull(products.priceMayorista));
    }

    const productItems = await db
      .select({
        id: products.id,
        productCode: products.productCode,
        name: products.name,
        description: products.description,
        priceCopBase: products.priceCopBase,
        priceCopR1: products.priceCopR1,
        priceCopR2: products.priceCopR2,
        priceCopR3: products.priceCopR3,
        priceViomar: products.priceViomar,
        priceColanta: products.priceColanta,
        priceMayorista: products.priceMayorista,
        priceUSD: products.priceUSD,
      })
      .from(products)
      .where(and(...productBaseFilters));

    const additionBaseFilters = [eq(additions.isActive, true)];

    if (catalogType === "INTERNACIONAL") {
      additionBaseFilters.push(isNotNull(additions.priceUSD));
    }

    const additionItems = await db
      .select({
        id: additions.id,
        additionCode: additions.additionCode,
        name: additions.name,
        description: additions.description,
        priceCopBase: additions.priceCopBase,
        priceUSD: additions.priceUSD,
      })
      .from(additions)
      .where(and(...additionBaseFilters));

    return Response.json({
      clients: normalizedClients,
      products: productItems,
      additions: additionItems,
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudieron cargar opciones de cotización", {
      status: 500,
    });
  }
}
