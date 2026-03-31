import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, orders, prefacturas, quotations } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { SiigoApiError, siigoJson } from "@/src/utils/siigo";

// SIIGO statuses that block re-sending
const BLOCKING_SIIGO_STATUSES = new Set(["SENT", "INVOICED"]);

// SIIGO document type ID for "Factura de venta electrónica".
// Configure via SIIGO_INVOICE_DOCUMENT_ID env var or keep the default (5743).
const SIIGO_INVOICE_DOCUMENT_ID = Number(
  process.env.SIIGO_INVOICE_DOCUMENT_ID ?? 5743,
);

// SIIGO tax code ID for IVA 19%.
// Configure via SIIGO_IVA_TAX_ID env var or keep the default (15329).
const SIIGO_IVA_TAX_ID = Number(process.env.SIIGO_IVA_TAX_ID ?? 15329);

// SIIGO product code used in the consolidated concept line.
// Configure via SIIGO_DEFAULT_PRODUCT_CODE env var or keep the default.
const SIIGO_DEFAULT_PRODUCT_CODE = String(
  process.env.SIIGO_DEFAULT_PRODUCT_CODE ?? "SVC001",
);

type SiigoInvoiceResponse = {
  id?: unknown;
  number?: unknown;
  date?: unknown;
  [key: string]: unknown;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "prefacturas:siigo:send",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await params;

  if (!id) {
    return new Response("Missing prefactura id", { status: 400 });
  }

  try {
    // Load prefactura with joined data needed for SIIGO payload
    const [row] = await db
      .select({
        id: prefacturas.id,
        prefacturaCode: prefacturas.prefacturaCode,
        status: prefacturas.status,
        subtotal: prefacturas.subtotal,
        ivaAmount: prefacturas.ivaAmount,
        ivaRate: prefacturas.ivaRate,
        total: prefacturas.total,
        totalAfterWithholdings: prefacturas.totalAfterWithholdings,
        siigoStatus: prefacturas.siigoStatus,
        orderId: prefacturas.orderId,
        quotationId: prefacturas.quotationId,
        clientId: prefacturas.clientId,
        currency: sql<
          string | null
        >`coalesce(${orders.currency}, ${quotations.currency}, 'COP')`,
        documentType: sql<string | null>`coalesce(
          cast(${quotations.documentType} as text),
          case when ${orders.ivaEnabled} then 'F' else 'R' end
        )`,
        clientIdentification: sql<
          string | null
        >`coalesce(${clients.identification}, (select c2.identification from clients c2 where c2.id = ${quotations.clientId}))`,
        clientName: sql<
          string | null
        >`coalesce(${clients.name}, (select c2.name from clients c2 where c2.id = ${quotations.clientId}))`,
      })
      .from(prefacturas)
      .leftJoin(quotations, eq(prefacturas.quotationId, quotations.id))
      .leftJoin(orders, eq(prefacturas.orderId, orders.id))
      .leftJoin(
        clients,
        sql`${clients.id} = coalesce(${orders.clientId}, ${quotations.clientId})`,
      )
      .where(eq(prefacturas.id, id))
      .limit(1);

    if (!row) {
      return new Response("Prefactura not found", { status: 404 });
    }

    // Only documentType = "F" can be sent to SIIGO
    if (row.documentType !== "F") {
      // Mark as NOT_APPLICABLE and return
      await db
        .update(prefacturas)
        .set({
          siigoStatus: "NOT_APPLICABLE",
          siigoLastSyncAt: new Date(),
        })
        .where(eq(prefacturas.id, id));

      return Response.json(
        {
          ok: false,
          reason: "NOT_APPLICABLE",
          message:
            "Esta prefactura es de tipo R (sin IVA) y no aplica para envío a SIIGO.",
        },
        { status: 400 },
      );
    }

    // Block if already SENT or INVOICED
    if (row.siigoStatus && BLOCKING_SIIGO_STATUSES.has(row.siigoStatus)) {
      return Response.json(
        {
          ok: false,
          reason: "ALREADY_SENT",
          message: `La prefactura ya fue enviada a SIIGO (estado: ${row.siigoStatus}). Para modificarla, primero anula el envío.`,
        },
        { status: 409 },
      );
    }

    const clientIdentification = String(
      row.clientIdentification ?? "",
    ).trim();

    if (!clientIdentification) {
      return Response.json(
        {
          ok: false,
          reason: "MISSING_CLIENT_IDENTIFICATION",
          message:
            "El cliente de esta prefactura no tiene número de identificación registrado. Completa los datos del cliente antes de enviar a SIIGO.",
        },
        { status: 422 },
      );
    }

    const subtotal = Number(row.subtotal ?? 0);
    const ivaAmount = Number(row.ivaAmount ?? 0);
    const total = Number(row.total ?? subtotal + ivaAmount);
    const ivaRate = Number(row.ivaRate ?? 19);
    const currency = String(row.currency ?? "COP").toUpperCase();

    // Build consolidated concept payload for SIIGO
    // Siigo requires document_type, customer, items, date
    const today = new Date().toISOString().slice(0, 10);

    const siigoPayload = {
      document: {
        id: SIIGO_INVOICE_DOCUMENT_ID,
      },
      date: today,
      customer: {
        identification: clientIdentification,
        branch_office: 0,
      },
      currency: {
        code: currency === "USD" ? "USD" : "COP",
        exchange_rate: currency === "USD" ? 1 : 0,
      },
      items: [
        {
          code: SIIGO_DEFAULT_PRODUCT_CODE,
          description: `Venta según prefactura ${row.prefacturaCode}`,
          quantity: 1,
          price: subtotal,
          taxes:
            ivaRate > 0
              ? [
                  {
                    id: SIIGO_IVA_TAX_ID,
                  },
                ]
              : [],
        },
      ],
      observations: `Prefactura ${row.prefacturaCode} - Total: ${total.toFixed(2)} ${currency}`,
    };

    // Call SIIGO to create the invoice
    let siigoResponse: SiigoInvoiceResponse;

    try {
      siigoResponse = await siigoJson<SiigoInvoiceResponse>("/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(siigoPayload),
      });
    } catch (siigoErr) {
      const errMsg =
        siigoErr instanceof SiigoApiError
          ? siigoErr.message
          : siigoErr instanceof Error
            ? siigoErr.message
            : "Error desconocido al contactar SIIGO";

      // Mark as ERROR
      await db
        .update(prefacturas)
        .set({
          siigoStatus: "ERROR",
          siigoErrorMessage: errMsg,
          siigoLastSyncAt: new Date(),
        })
        .where(eq(prefacturas.id, id));

      return Response.json(
        { ok: false, reason: "SIIGO_ERROR", message: errMsg },
        { status: 502 },
      );
    }

    const siigoInvoiceId = String(siigoResponse?.id ?? "").trim() || null;
    const siigoInvoiceNumber =
      String(siigoResponse?.number ?? "").trim() || null;

    // Update prefactura as SENT
    await db
      .update(prefacturas)
      .set({
        siigoStatus: "SENT",
        siigoInvoiceId,
        siigoInvoiceNumber,
        siigoSentAt: new Date(),
        siigoLastSyncAt: new Date(),
        siigoErrorMessage: null,
      })
      .where(eq(prefacturas.id, id));

    return Response.json({
      ok: true,
      siigoStatus: "SENT",
      siigoInvoiceId,
      siigoInvoiceNumber,
    });
  } catch (error) {
    console.error("[prefacturas siigo send] error:", {
      code: (error as any)?.code,
      message: (error as any)?.message,
    });

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 },
    );
  }
}
