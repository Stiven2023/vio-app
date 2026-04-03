import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { supplierInvoices } from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { postSupplierInvoiceEntry } from "@/src/utils/accounting-entries";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function str(value: unknown) {
  return String(value ?? "").trim();
}

/**
 * PUT /api/supplier-invoices/[id]/post-accounting
 * Transitions APROBADA → CONTABILIZADA and creates the accounting entry.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "supplier-invoices:post-accounting",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CONTABILIZAR_FACTURA_PROVEEDOR");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const invoiceId = str(id);

    if (!invoiceId) return new Response("id required", { status: 400 });

    const employeeId = getEmployeeIdFromRequest(request);

    const result = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select({
          id: supplierInvoices.id,
          invoiceCode: supplierInvoices.invoiceCode,
          status: supplierInvoices.status,
          supplierId: supplierInvoices.supplierId,
          purchaseOrderReceiptId: supplierInvoices.purchaseOrderReceiptId,
          invoiceDate: supplierInvoices.invoiceDate,
          subtotal: supplierInvoices.subtotal,
          ivaAmount: supplierInvoices.ivaAmount,
          withholdingTax: supplierInvoices.withholdingTax,
          withholdingIva: supplierInvoices.withholdingIva,
          withholdingIca: supplierInvoices.withholdingIca,
          total: supplierInvoices.total,
        })
        .from(supplierInvoices)
        .where(eq(supplierInvoices.id, invoiceId))
        .limit(1);

      if (!invoice) return { kind: "not-found" as const };
      if (invoice.status !== "APROBADA") return { kind: "invalid-status" as const, status: invoice.status };

      const entry = await postSupplierInvoiceEntry(
        tx,
        {
          invoiceId: invoice.id,
          invoiceCode: invoice.invoiceCode,
          supplierId: invoice.supplierId,
          receiptId: invoice.purchaseOrderReceiptId,
          invoiceDate: String(invoice.invoiceDate),
          subtotal: invoice.subtotal,
          ivaAmount: invoice.ivaAmount,
          withholdingTax: invoice.withholdingTax,
          withholdingIva: invoice.withholdingIva,
          withholdingIca: invoice.withholdingIca,
          total: invoice.total,
        },
        employeeId,
      );

      await tx
        .update(supplierInvoices)
        .set({
          status: "CONTABILIZADA",
          accountingEntryId: entry.id,
          updatedAt: new Date(),
        })
        .where(eq(supplierInvoices.id, invoiceId));

      return { kind: "ok" as const, entryNumber: entry.entryNumber };
    });

    if (result.kind === "not-found") return new Response("Factura no encontrada", { status: 404 });
    if (result.kind === "invalid-status") {
      return new Response(
        `La factura debe estar APROBADA para contabilizarse (estado actual: ${result.status})`,
        { status: 422 },
      );
    }

    return Response.json(result);
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo contabilizar la factura", { status: 500 });
  }
}
