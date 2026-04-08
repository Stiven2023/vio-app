import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  cashReceiptApplications,
  cashReceipts,
  clients,
  orderItems,
  orders,
  preInvoices as prefacturas,
  products,
  quotationItems,
  quotations,
} from "@/src/db/erp/schema";
import {
  normalizeProtectedRouteError,
  prefacturaIdRequiredError,
  prefacturaNotFoundError,
  siigoAlreadySentError,
  siigoDryRunError,
  siigoInternalError,
  siigoMissingClientIdentificationError,
  siigoMissingConfigurationError,
  siigoNotApplicableError,
  siigoRequiresFullPaymentError,
  siigoUpstreamError,
} from "@/src/utils/prefactura-siigo-contract";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { SiigoApiError, siigoJson } from "@/src/utils/siigo";
import { buildSiigoProductPayload } from "@/src/utils/siigo-products";

// SIIGO statuses that block re-sending
const BLOCKING_SIIGO_STATUSES = new Set([
  "SENT",
  "INVOICED",
  "ACCEPTED",
]);

// SIIGO product code used in the consolidated concept line.
// Configure via SIIGO_DEFAULT_PRODUCT_CODE env var or keep the default.
const SIIGO_DEFAULT_PRODUCT_CODE = String(
  process.env.SIIGO_DEFAULT_PRODUCT_CODE ?? "SVC001",
);

function isSiigoLiveSubmissionEnabled() {
  const raw = String(process.env.SIIGO_ALLOW_LIVE_SUBMISSION ?? "")
    .trim()
    .toLowerCase();

  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function isProductionEnvironment() {
  return String(process.env.NODE_ENV ?? "").trim().toLowerCase() === "production";
}

function readPositiveNumberEnv(name: string) {
  const raw = String(process.env[name] ?? "").trim();

  if (!raw) {
    return { ok: false as const, reason: "MISSING" as const };
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false as const, reason: "INVALID" as const };
  }

  return { ok: true as const, value };
}

function valueFromPositiveEnvState(state: {
  ok: boolean;
  value?: number;
}) {
  if (!state.ok || typeof state.value !== "number") {
    throw new Error("Invalid SIIGO numeric configuration state.");
  }

  return state.value;
}

function sanitizeSiigoProductCode(code: string) {
  const cleaned = String(code ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 30);

  if (!cleaned) {
    return SIIGO_DEFAULT_PRODUCT_CODE;
  }

  return cleaned;
}

function toValidQuantity(value: unknown) {
  const n = Number(value);

  if (!Number.isFinite(n) || n <= 0) return 1;

  return n;
}

function toValidPrice(value: unknown) {
  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) return 0;

  return n;
}

type SiigoInvoiceResponse = {
  id?: unknown;
  number?: unknown;
  date?: unknown;
  [key: string]: unknown;
};

type BillingLine = {
  productId: string | null;
  productCode: string | null;
  productName: string | null;
  quantity: string | number | null;
  unitPrice: string | number | null;
  fallbackName: string | null;
};

async function ensureProductMappedInSiigo(args: {
  productId: string;
  productCode: string;
  productName: string;
  unitPrice: number;
  accountGroup: number;
  taxId: number;
}) {
  const payload = await buildSiigoProductPayload(
    {
      productCode: sanitizeSiigoProductCode(args.productCode),
      name: args.productName,
      priceCopBase: args.unitPrice.toFixed(2),
    },
    args.accountGroup,
    args.taxId,
  );

  try {
    const result = await siigoJson<{ id?: unknown }>("/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const siigoId = String(result.id ?? "").trim() || null;

    await db
      .update(products)
      .set({
        siigoSynced: true,
        siigoSyncedAt: new Date(),
        siigoSyncError: null,
        siigoId,
      })
      .where(eq(products.id, args.productId));
  } catch (err) {
    if (err instanceof SiigoApiError) {
      const payloadError = err.payload as Record<string, unknown>;
      const errors = payloadError.Errors as Array<Record<string, unknown>> | undefined;
      const first = errors?.[0];
      const message = String(
        first?.Message ?? first?.message ?? payloadError.message ?? err.message,
      );

      // Accept SIIGO "already exists" as mapped state.
      if (/already exists|ya existe/i.test(message)) {
        await db
          .update(products)
          .set({
            siigoSynced: true,
            siigoSyncedAt: new Date(),
            siigoSyncError: null,
            siigoId: sanitizeSiigoProductCode(args.productCode),
          })
          .where(eq(products.id, args.productId));

        return;
      }

      await db
        .update(products)
        .set({
          siigoSynced: false,
          siigoSyncError: message,
        })
        .where(eq(products.id, args.productId));

      throw new Error(
        `No fue posible sincronizar el producto ${args.productCode} en SIIGO: ${message}`,
      );
    }

    throw err;
  }
}

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

  const forbidden = normalizeProtectedRouteError(
    await requirePermission(request, "EDITAR_PEDIDO"),
    "No tienes permisos para enviar prefacturas a SIIGO.",
  );

  if (forbidden) return forbidden;

  const { id } = await params;

  if (!id) {
    return prefacturaIdRequiredError();
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
        paidAmount: sql<string>`coalesce((
          select sum(${cashReceiptApplications.appliedAmount})
          from ${cashReceiptApplications}
          inner join ${cashReceipts}
            on ${cashReceipts.id} = ${cashReceiptApplications.cashReceiptId}
          where ${cashReceiptApplications.prefacturaId} = ${prefacturas.id}
            and ${cashReceipts.status} = 'CONFIRMED'
        ), 0)::text`,
        refundStatus: prefacturas.refundStatus,
        refundPendingAmount: prefacturas.refundPendingAmount,
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
      return prefacturaNotFoundError();
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

      return siigoNotApplicableError();
    }

    // Block if already SENT or INVOICED
    if (row.siigoStatus && BLOCKING_SIIGO_STATUSES.has(row.siigoStatus)) {
      return siigoAlreadySentError(row.siigoStatus);
    }

    const totalAmount = Number(row.total ?? 0);
    const paidAmount = Number(row.paidAmount ?? 0);
    const overpaymentAmount = Math.max(0, paidAmount - totalAmount);
    const paymentDiff = Math.abs(paidAmount - totalAmount);

    // Only exact full-payment (100%) is valid for SIIGO emission.
    if (
      !Number.isFinite(totalAmount) ||
      totalAmount <= 0 ||
      !Number.isFinite(paidAmount) ||
      paymentDiff > 0.01
    ) {
      if (overpaymentAmount > 0) {
        await db
          .update(prefacturas)
          .set({
            refundStatus: "PENDING",
            refundPendingAmount: overpaymentAmount.toFixed(2),
            refundStatusUpdatedAt: new Date(),
          })
          .where(eq(prefacturas.id, id));
      }

      return siigoRequiresFullPaymentError({
        paidAmount,
        totalAmount,
        overpaymentAmount,
      });
    }

    // If there was a pending refund and now the settlement is exact, mark as resolved.
    if (String(row.refundStatus ?? "").toUpperCase() === "PENDING") {
      await db
        .update(prefacturas)
        .set({
          refundStatus: "RESOLVED",
          refundPendingAmount: "0",
          refundStatusUpdatedAt: new Date(),
        })
        .where(eq(prefacturas.id, id));
    }

    const clientIdentification = String(
      row.clientIdentification ?? "",
    ).trim();

    if (!clientIdentification) {
      return siigoMissingClientIdentificationError();
    }

    const subtotal = Number(row.subtotal ?? 0);
    const ivaAmount = Number(row.ivaAmount ?? 0);
    const total = Number(row.total ?? subtotal + ivaAmount);
    const ivaRate = Number(row.ivaRate ?? 19);
    const currency = String(row.currency ?? "COP").toUpperCase();

    const requiredNumericConfig = {
      SIIGO_INVOICE_DOCUMENT_ID: readPositiveNumberEnv(
        "SIIGO_INVOICE_DOCUMENT_ID",
      ),
      SIIGO_IVA_TAX_ID: readPositiveNumberEnv("SIIGO_IVA_TAX_ID"),
      SIIGO_SELLER_ID: readPositiveNumberEnv("SIIGO_SELLER_ID"),
      SIIGO_PAYMENT_METHOD_ID: readPositiveNumberEnv("SIIGO_PAYMENT_METHOD_ID"),
      SIIGO_PRODUCT_ACCOUNT_GROUP: readPositiveNumberEnv(
        "SIIGO_PRODUCT_ACCOUNT_GROUP",
      ),
    } as const;

    const missingConfig = Object.entries(requiredNumericConfig)
      .filter(([, state]) => !state.ok && state.reason === "MISSING")
      .map(([key]) => key);
    const invalidConfig = Object.entries(requiredNumericConfig)
      .filter(([, state]) => !state.ok && state.reason === "INVALID")
      .map(([key]) => key);

    if (missingConfig.length > 0 || invalidConfig.length > 0) {
      return siigoMissingConfigurationError({
        missingConfig,
        invalidConfig,
      });
    }

    const siigoInvoiceDocumentId = valueFromPositiveEnvState(
      requiredNumericConfig.SIIGO_INVOICE_DOCUMENT_ID,
    );
    const siigoIvaTaxId = valueFromPositiveEnvState(
      requiredNumericConfig.SIIGO_IVA_TAX_ID,
    );
    const siigoSellerId = valueFromPositiveEnvState(
      requiredNumericConfig.SIIGO_SELLER_ID,
    );
    const siigoPaymentMethodId = valueFromPositiveEnvState(
      requiredNumericConfig.SIIGO_PAYMENT_METHOD_ID,
    );
    const siigoProductAccountGroup = valueFromPositiveEnvState(
      requiredNumericConfig.SIIGO_PRODUCT_ACCOUNT_GROUP,
    );

    let lines: BillingLine[] = [];

    if (row.orderId) {
      lines = await db
        .select({
          productId: orderItems.productId,
          productCode: products.productCode,
          productName: products.name,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          fallbackName: orderItems.name,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, row.orderId));
    } else if (row.quotationId) {
      lines = await db
        .select({
          productId: quotationItems.productId,
          productCode: products.productCode,
          productName: products.name,
          quantity: quotationItems.quantity,
          unitPrice: quotationItems.unitPrice,
          fallbackName: products.name,
        })
        .from(quotationItems)
        .leftJoin(products, eq(quotationItems.productId, products.id))
        .where(eq(quotationItems.quotationId, row.quotationId));
    }

    const itemPayload: Array<{
      code: string;
      description: string;
      quantity: number;
      price: number;
      taxes: Array<{ id: number }>;
    }> = [];

    for (const line of lines) {
      const code = sanitizeSiigoProductCode(
        line.productCode ?? SIIGO_DEFAULT_PRODUCT_CODE,
      );
      const description = String(line.productName ?? line.fallbackName ?? code)
        .trim()
        .slice(0, 250);
      const quantity = toValidQuantity(line.quantity);
      const price = toValidPrice(line.unitPrice);

      if (line.productId && line.productCode) {
        const [productRow] = await db
          .select({
            id: products.id,
            productCode: products.productCode,
            name: products.name,
            siigoSynced: products.siigoSynced,
          })
          .from(products)
          .where(eq(products.id, line.productId))
          .limit(1);

        if (productRow && !productRow.siigoSynced) {
          await ensureProductMappedInSiigo({
            productId: productRow.id,
            productCode: productRow.productCode,
            productName: productRow.name,
            unitPrice: price,
            accountGroup: siigoProductAccountGroup,
            taxId: siigoIvaTaxId,
          });
        }
      }

      itemPayload.push({
        code,
        description: description || `Producto ${code}`,
        quantity,
        price,
        taxes: ivaRate > 0 ? [{ id: siigoIvaTaxId }] : [],
      });
    }

    if (itemPayload.length === 0) {
      itemPayload.push({
        code: SIIGO_DEFAULT_PRODUCT_CODE,
        description: `Venta según prefactura ${row.prefacturaCode}`,
        quantity: 1,
        price: subtotal,
        taxes: ivaRate > 0 ? [{ id: siigoIvaTaxId }] : [],
      });
    }

    // Build consolidated concept payload for SIIGO
    // Siigo requires document_type, customer, items, date
    const today = new Date().toISOString().slice(0, 10);

    const siigoPayload = {
      document: {
        id: siigoInvoiceDocumentId,
      },
      date: today,
      customer: {
        identification: clientIdentification,
        branch_office: 0,
      },
      seller: {
        id: siigoSellerId,
      },
      currency: {
        code: currency === "USD" ? "USD" : "COP",
        exchange_rate: currency === "USD" ? 1 : 0,
      },
      items: itemPayload,
      payments: [
        {
          id: siigoPaymentMethodId,
          value: total,
          due_date: today,
        },
      ],
      observations: `Prefactura ${row.prefacturaCode} - Total: ${total.toFixed(2)} ${currency}`,
    };

    const liveSubmissionEnabled = isSiigoLiveSubmissionEnabled();
    const productionEnvironment = isProductionEnvironment();

    if (!liveSubmissionEnabled || !productionEnvironment) {
      await db
        .update(prefacturas)
        .set({
          siigoStatus: "READY",
          siigoLastSyncAt: new Date(),
          siigoErrorMessage:
            "Modo prueba activo: envío real a SIIGO deshabilitado (requiere SIIGO_ALLOW_LIVE_SUBMISSION=true y NODE_ENV=production).",
        })
        .where(eq(prefacturas.id, id));

      return siigoDryRunError({
        liveSubmissionEnabled,
        productionEnvironment,
        preview: {
          prefacturaId: row.id,
          prefacturaCode: row.prefacturaCode,
          documentType: row.documentType,
          items: itemPayload.length,
          total,
          currency,
        },
      });
    }

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

      return siigoUpstreamError("No fue posible enviar la prefactura a SIIGO.");
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

    return siigoInternalError("No se pudo enviar la prefactura a SIIGO.");
  }
}
