import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { orders, prefacturas, quotations } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { SiigoApiError, siigoJson } from "@/src/utils/siigo";

type GenericRecord = Record<string, unknown>;

function findFirstHttpUrl(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstHttpUrl(item);

      if (found) return found;
    }

    return null;
  }

  if (typeof value === "object") {
    const rec = value as GenericRecord;
    const preferredKeys = [
      "pdf",
      "pdf_url",
      "pdfUrl",
      "download_url",
      "downloadUrl",
      "public_url",
      "publicUrl",
      "url",
      "href",
      "link",
    ];

    for (const key of preferredKeys) {
      const found = findFirstHttpUrl(rec[key]);

      if (found) return found;
    }

    for (const nested of Object.values(rec)) {
      const found = findFirstHttpUrl(nested);

      if (found) return found;
    }
  }

  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestUrl = new URL(request.url);
  const resolveOnly =
    requestUrl.searchParams.get("resolve") === "1" ||
    requestUrl.searchParams.get("mode") === "resolve";

  const limited = rateLimit(request, {
    key: "prefacturas:siigo:official-invoice-pdf",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const prefacturaId = String(id ?? "").trim();

  if (!prefacturaId) {
    return Response.json(
      {
        ok: false,
        reason: "MISSING_PREFAC_ID",
        message: "Missing prefactura id.",
      },
      { status: 400 },
    );
  }

  const [pf] = await db
    .select({
      id: prefacturas.id,
      prefacturaCode: prefacturas.prefacturaCode,
      documentType: sql<string | null>`coalesce(
        cast(${quotations.documentType} as text),
        case when ${orders.ivaEnabled} then 'F' else 'R' end
      )`,
      siigoInvoiceId: prefacturas.siigoInvoiceId,
      siigoStatus: prefacturas.siigoStatus,
    })
    .from(prefacturas)
    .leftJoin(quotations, eq(prefacturas.quotationId, quotations.id))
    .leftJoin(orders, eq(prefacturas.orderId, orders.id))
    .where(eq(prefacturas.id, prefacturaId))
    .limit(1);

  if (!pf) {
    return Response.json(
      {
        ok: false,
        reason: "PREFAC_NOT_FOUND",
        message: "Prefactura not found.",
      },
      { status: 404 },
    );
  }

  if (
    String(pf.documentType ?? "")
      .trim()
      .toUpperCase() !== "F"
  ) {
    return Response.json(
      {
        ok: false,
        reason: "NOT_APPLICABLE",
        message:
          "Solo las prefacturas tipo F generan factura oficial en SIIGO.",
      },
      { status: 409 },
    );
  }

  const siigoInvoiceId = String(pf.siigoInvoiceId ?? "").trim();

  if (!siigoInvoiceId) {
    return Response.json(
      {
        ok: false,
        reason: "MISSING_SIIGO_INVOICE_ID",
        message:
          "Aun no hay factura oficial en SIIGO para esta prefactura. Primero envia y confirma estado.",
      },
      { status: 422 },
    );
  }

  try {
    const invoicePayload = await siigoJson<GenericRecord>(
      `/v1/invoices/${encodeURIComponent(siigoInvoiceId)}`,
    );

    const officialUrl = findFirstHttpUrl(invoicePayload);

    if (!officialUrl) {
      return Response.json(
        {
          ok: false,
          reason: "OFFICIAL_PDF_NOT_AVAILABLE",
          message:
            "SIIGO no reporto aun una URL de PDF oficial para esta factura. Intenta de nuevo tras actualizar estado SIIGO.",
          siigoInvoiceId,
          siigoStatus: pf.siigoStatus,
        },
        { status: 409 },
      );
    }

    if (resolveOnly) {
      return Response.json({
        ok: true,
        officialPdfUrl: officialUrl,
        siigoInvoiceId,
        siigoStatus: pf.siigoStatus,
      });
    }

    return Response.redirect(officialUrl, 302);
  } catch (error) {
    const message =
      error instanceof SiigoApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No fue posible consultar la factura oficial en SIIGO.";

    return Response.json(
      {
        ok: false,
        reason: "SIIGO_OFFICIAL_INVOICE_FETCH_FAILED",
        message,
      },
      { status: 502 },
    );
  }
}
