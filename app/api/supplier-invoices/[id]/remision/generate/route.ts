import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { supplierInvoices } from "@/src/db/erp/schema";
import { jsonError } from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

// ── POST /api/supplier-invoices/[id]/remision/generate ────────────────────────
// Generates a remision for a type-R (or null-type) supplier invoice.
// Marks siigoStatus as NOT_APPLICABLE since remisions are not sent to Siigo.

function str(v: unknown) {
  return String(v ?? "").trim();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "supplier-invoices:remision:generate",
    limit: 30,
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
    })
    .from(supplierInvoices)
    .where(eq(supplierInvoices.id, invoiceId))
    .limit(1);

  if (!invoice) {
    return jsonError(404, "NOT_FOUND", "Factura de proveedor no encontrada.");
  }

  if (invoice.documentType === "F") {
    return jsonError(
      422,
      "REMISION_NOT_APPLICABLE",
      "Las facturas tipo F deben enviarse a SIIGO, no generar remision.",
    );
  }

  const blockedStatuses = new Set(["SENT", "INVOICED", "ACCEPTED"]);

  if (
    invoice.siigoStatus &&
    blockedStatuses.has(str(invoice.siigoStatus).toUpperCase())
  ) {
    return jsonError(
      409,
      "SIIGO_ALREADY_PROCESSED",
      "Este documento ya fue procesado en SIIGO.",
    );
  }

  await db
    .update(supplierInvoices)
    .set({ siigoStatus: "NOT_APPLICABLE", updatedAt: new Date() })
    .where(eq(supplierInvoices.id, invoiceId));

  return Response.json({
    ok: true,
    invoiceCode: invoice.invoiceCode,
    siigoStatus: "NOT_APPLICABLE",
    message: `Remision generada para ${invoice.invoiceCode}.`,
  });
}
