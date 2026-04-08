import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { supplierInvoices } from "@/src/db/erp/schema";
import { jsonError } from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

// ── POST /api/supplier-invoices/[id]/siigo/send ───────────────────────────────
// Marks a type-F supplier invoice as sent to Siigo.
// NOTE: Full Siigo push for purchase invoices (POST /v1/purchase-invoices) requires
// Siigo API documentation for the purchase endpoint — this endpoint currently
// updates the siigoStatus to "SENT" as a stub. Extend with the actual Siigo call
// once the purchase invoice API contract is confirmed.

const BLOCKING_SIIGO_STATUSES = new Set(["SENT", "INVOICED", "ACCEPTED"]);

function str(v: unknown) {
  return String(v ?? "").trim();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "supplier-invoices:siigo:send",
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_FACTURA_PROVEEDOR");

  if (forbidden) return forbidden;

  const { id } = await params;
  const invoiceId = str(id);

  if (!invoiceId) {
    return jsonError(400, "ID_REQUIRED", "Se requiere el id de la factura.");
  }

  const [invoice] = await db
    .select({
      id: supplierInvoices.id,
      invoiceCode: supplierInvoices.invoiceCode,
      documentType: supplierInvoices.documentType,
      siigoStatus: supplierInvoices.siigoStatus,
      status: supplierInvoices.status,
    })
    .from(supplierInvoices)
    .where(eq(supplierInvoices.id, invoiceId))
    .limit(1);

  if (!invoice) {
    return jsonError(404, "NOT_FOUND", "Factura de proveedor no encontrada.");
  }

  if (invoice.documentType !== "F") {
    return jsonError(
      422,
      "SIIGO_NOT_APPLICABLE",
      "Solo las facturas de tipo F pueden enviarse a SIIGO.",
    );
  }

  if (
    invoice.siigoStatus &&
    BLOCKING_SIIGO_STATUSES.has(str(invoice.siigoStatus).toUpperCase())
  ) {
    return jsonError(
      409,
      "SIIGO_ALREADY_SENT",
      "Esta factura ya fue procesada en SIIGO.",
    );
  }

  // TODO: Integrate actual Siigo purchase invoice API call here
  // e.g. POST /v1/purchase-invoices with the required payload.
  // For now we record the intent and mark status as SENT.
  await db
    .update(supplierInvoices)
    .set({ siigoStatus: "SENT", updatedAt: new Date() })
    .where(eq(supplierInvoices.id, invoiceId));

  return Response.json({
    ok: true,
    invoiceCode: invoice.invoiceCode,
    siigoStatus: "SENT",
    message: `Factura ${invoice.invoiceCode} marcada como enviada a SIIGO.`,
  });
}
