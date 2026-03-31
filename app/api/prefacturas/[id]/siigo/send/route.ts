import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  orderItems,
  orders,
  prefacturas,
  products,
  quotationItems,
  quotations,
} from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { SiigoApiError, siigoJson } from "@/src/utils/siigo";

// Blocked statuses (no resend without admin reset)
const BLOCKED_STATUSES = new Set([
  "SENT",
  "ACCEPTED",
  "REJECTED",
]);

type SiigoInvoiceResponse = {
  id?: unknown;
  name?: unknown;
  date?: unknown;
};

function getRequiredEnvInt(name: string): number | null {
  const raw = process.env[name];

  if (!raw?.trim()) return null;
  const value = parseInt(raw.trim(), 10);

  return Number.isFinite(value) && value > 0 ? value : null;
}

function getInvoiceConfig() {
  const missing: string[] = [];

  const accountGroup = getRequiredEnvInt("SIIGO_INVOICE_ACCOUNT_GROUP");
  const sellerId = getRequiredEnvInt("SIIGO_SELLER_ID");
  const taxId19 = getRequiredEnvInt("SIIGO_TAX_ID_19");
  const paymentCashId = getRequiredEnvInt("SIIGO_PAYMENT_CASH_ID");
  const paymentCreditId = getRequiredEnvInt("SIIGO_PAYMENT_CREDIT_ID");

  if (!accountGroup) missing.push("SIIGO_INVOICE_ACCOUNT_GROUP");
  if (!sellerId) missing.push("SIIGO_SELLER_ID");
  if (!taxId19) missing.push("SIIGO_TAX_ID_19");
  if (!paymentCashId) missing.push("SIIGO_PAYMENT_CASH_ID");

  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno requeridas para facturación electrónica: ${missing.join(", ")}. Configúralas y reinicia el servidor.`,
    );
  }

  return {
    accountGroup: accountGroup!,
    sellerId: sellerId!,
    taxId19: taxId19!,
    paymentCashId: paymentCashId!,
    paymentCreditId: paymentCreditId ?? paymentCashId!,
  };
}

// ── POST /api/prefacturas/[id]/siigo/send ─────────────────────────────────────

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "prefacturas:siigo:send",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const prefacturaId = String(params.id ?? "").trim();

  if (!prefacturaId) {
    return Response.json({ error: "ID de prefactura requerido." }, { status: 400 });
  }

  // ── 1. Load prefactura ────────────────────────────────────────────────────

  const [pf] = await db
    .select({
      id: prefacturas.id,
      prefacturaCode: prefacturas.prefacturaCode,
      orderId: prefacturas.orderId,
      quotationId: prefacturas.quotationId,
      status: prefacturas.status,
      total: prefacturas.total,
      subtotal: prefacturas.subtotal,
      ivaAmount: prefacturas.ivaAmount,
      ivaRate: prefacturas.ivaRate,
      paymentType: prefacturas.paymentType,
      dueDate: prefacturas.dueDate,
      approvedAt: prefacturas.approvedAt,
      siigoStatus: prefacturas.siigoStatus,
      // documentType computed from quotation or order
      documentType: sql<string>`coalesce(
        cast(${quotations.documentType} as text),
        case when ${orders.ivaEnabled} then 'F' else 'R' end
      )`,
      clientIdentification: sql<string | null>`coalesce(
        ${clients.identification},
        (select c2.identification from clients c2 where c2.id = ${quotations.clientId})
      )`,
      clientName: sql<string | null>`coalesce(
        ${clients.name},
        (select c2.name from clients c2 where c2.id = ${quotations.clientId})
      )`,
    })
    .from(prefacturas)
    .leftJoin(quotations, eq(prefacturas.quotationId, quotations.id))
    .leftJoin(orders, eq(prefacturas.orderId, orders.id))
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .where(eq(prefacturas.id, prefacturaId))
    .limit(1);

  if (!pf) {
    return Response.json(
      { error: "Prefactura no encontrada." },
      { status: 404 },
    );
  }

  // ── 2. Validate documentType (only F can be sent) ─────────────────────────

  if (pf.documentType !== "F") {
    // Mark as NOT_APPLICABLE if not already
    if (pf.siigoStatus !== "NOT_APPLICABLE") {
      await db
        .update(prefacturas)
        .set({ siigoStatus: "NOT_APPLICABLE" })
        .where(eq(prefacturas.id, prefacturaId));
    }

    return Response.json(
      {
        error:
          "Solo las prefacturas tipo F (con IVA) pueden enviarse a SIIGO.",
        siigoStatus: "NOT_APPLICABLE",
      },
      { status: 400 },
    );
  }

  // ── 3. Check blocked states ───────────────────────────────────────────────

  if (pf.siigoStatus && BLOCKED_STATUSES.has(pf.siigoStatus)) {
    return Response.json(
      {
        error: `Esta prefactura ya está en estado SIIGO "${pf.siigoStatus}" y no puede reenviarse sin un reset administrativo.`,
        siigoStatus: pf.siigoStatus,
      },
      { status: 409 },
    );
  }

  // ── 4. Validate client identification ─────────────────────────────────────

  if (!pf.clientIdentification) {
    return Response.json(
      {
        error:
          "El cliente de la prefactura no tiene número de identificación configurado. Actualiza el cliente antes de enviar a SIIGO.",
      },
      { status: 422 },
    );
  }

  // ── 5. Get invoice line items ─────────────────────────────────────────────

  type LineItem = {
    productCode: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    siigoSynced: boolean;
    siigoId: string | null;
  };

  let lineItems: LineItem[] = [];

  if (pf.orderId) {
    const rows = await db
      .select({
        productCode: products.productCode,
        productName: products.name,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        siigoSynced: products.siigoSynced,
        siigoId: products.siigoId,
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .where(
        and(
          eq(orderItems.orderId, pf.orderId),
          eq(orderItems.isActive, true),
        ),
      );

    lineItems = rows.map((r) => ({
      productCode: r.productCode,
      productName: r.productName,
      quantity: r.quantity,
      unitPrice: parseFloat(String(r.unitPrice ?? "0")) || 0,
      siigoSynced: Boolean(r.siigoSynced),
      siigoId: r.siigoId,
    }));
  } else if (pf.quotationId) {
    const rows = await db
      .select({
        productCode: products.productCode,
        productName: products.name,
        quantity: quotationItems.quantity,
        unitPrice: quotationItems.unitPrice,
        siigoSynced: products.siigoSynced,
        siigoId: products.siigoId,
      })
      .from(quotationItems)
      .innerJoin(products, eq(quotationItems.productId, products.id))
      .where(eq(quotationItems.quotationId, pf.quotationId));

    lineItems = rows.map((r) => ({
      productCode: r.productCode,
      productName: r.productName,
      quantity: parseFloat(String(r.quantity ?? "1")) || 1,
      unitPrice: parseFloat(String(r.unitPrice ?? "0")) || 0,
      siigoSynced: Boolean(r.siigoSynced),
      siigoId: r.siigoId,
    }));
  }

  if (lineItems.length === 0) {
    return Response.json(
      {
        error:
          "La prefactura no tiene productos asociados. Verifica el pedido o cotización.",
      },
      { status: 422 },
    );
  }

  // ── 6. Verify all products are synced with SIIGO ──────────────────────────

  const unsyncedProducts = lineItems.filter((item) => !item.siigoSynced);

  if (unsyncedProducts.length > 0) {
    return Response.json(
      {
        error: `Los siguientes productos no están sincronizados con SIIGO: ${unsyncedProducts.map((p) => p.productCode).join(", ")}. Sincronízalos primero antes de enviar la factura.`,
        unsyncedProducts: unsyncedProducts.map((p) => p.productCode),
      },
      { status: 422 },
    );
  }

  // ── 7. Load invoice configuration from env ────────────────────────────────

  let config: ReturnType<typeof getInvoiceConfig>;

  try {
    config = getInvoiceConfig();
  } catch (err) {
    return Response.json(
      { error: String((err as Error)?.message ?? "Configuración inválida.") },
      { status: 503 },
    );
  }

  // ── 8. Build SIIGO invoice payload ────────────────────────────────────────

  const invoiceDate =
    pf.approvedAt
      ? new Date(pf.approvedAt).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

  const isCredit = String(pf.paymentType ?? "CASH").toUpperCase() === "CREDIT";
  const dueDate =
    isCredit && pf.dueDate
      ? String(pf.dueDate).split("T")[0]
      : invoiceDate;

  const totalValue = parseFloat(String(pf.total ?? "0")) || 0;

  const siigoItems = lineItems.map((item) => ({
    code: item.productCode,
    description: item.productName.substring(0, 250),
    quantity: item.quantity,
    price: item.unitPrice,
    discount: 0,
    taxes: [{ id: config.taxId19 }],
  }));

  const invoicePayload = {
    document: { id: config.accountGroup },
    date: invoiceDate,
    customer: {
      identification: pf.clientIdentification,
      branch_office: 0,
    },
    seller: config.sellerId,
    items: siigoItems,
    payments: [
      {
        id: isCredit ? config.paymentCreditId : config.paymentCashId,
        value: totalValue,
        due_date: dueDate,
      },
    ],
    observations: `Prefactura ${pf.prefacturaCode}`,
  };

  // ── 9. Send to SIIGO ──────────────────────────────────────────────────────

  try {
    const result = await siigoJson<SiigoInvoiceResponse>("/v1/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoicePayload),
    });

    const siigoInvoiceId = String(result.id ?? "").trim();
    const siigoInvoiceNumber = String(result.name ?? "").trim();

    if (!siigoInvoiceId) {
      await db
        .update(prefacturas)
        .set({
          siigoStatus: "ERROR",
          siigoErrorMessage: "SIIGO no devolvió un ID de factura.",
          siigoLastSyncAt: new Date(),
        })
        .where(eq(prefacturas.id, prefacturaId));

      return Response.json(
        { error: "SIIGO no devolvió un ID de factura." },
        { status: 502 },
      );
    }

    await db
      .update(prefacturas)
      .set({
        siigoStatus: "SENT",
        siigoInvoiceId,
        siigoInvoiceNumber: siigoInvoiceNumber || null,
        siigoSentAt: new Date(),
        siigoLastSyncAt: new Date(),
        siigoErrorMessage: null,
      })
      .where(eq(prefacturas.id, prefacturaId));

    return Response.json({
      ok: true,
      siigoStatus: "SENT",
      siigoInvoiceId,
      siigoInvoiceNumber: siigoInvoiceNumber || null,
    });
  } catch (err) {
    let message = "Error al crear factura en SIIGO.";

    if (err instanceof SiigoApiError) {
      const body = err.payload as Record<string, unknown>;
      const errors = body?.Errors as unknown[] | undefined;
      const firstError = errors?.[0] as Record<string, unknown> | undefined;

      message =
        String(
          firstError?.Message ??
            firstError?.message ??
            body?.message ??
            err.message,
        ) || message;
    } else {
      message = String((err as Error)?.message ?? message);
    }

    await db
      .update(prefacturas)
      .set({
        siigoStatus: "ERROR",
        siigoErrorMessage: message,
        siigoLastSyncAt: new Date(),
      })
      .where(eq(prefacturas.id, prefacturaId));

    return Response.json({ error: message }, { status: 502 });
  }
}
