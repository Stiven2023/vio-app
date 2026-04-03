import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { supplierInvoices } from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function str(value: unknown) {
  return String(value ?? "").trim();
}

/** PUT /api/supplier-invoices/[id]/verify → RECIBIDA → VERIFICADA */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, { key: "supplier-invoices:verify", limit: 60, windowMs: 60_000 });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VERIFICAR_FACTURA_PROVEEDOR");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const invoiceId = str(id);

    if (!invoiceId) return new Response("id required", { status: 400 });

    const result = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select({ id: supplierInvoices.id, status: supplierInvoices.status })
        .from(supplierInvoices)
        .where(eq(supplierInvoices.id, invoiceId))
        .limit(1);

      if (!invoice) return { kind: "not-found" as const };
      if (invoice.status !== "RECIBIDA") return { kind: "invalid-status" as const, status: invoice.status };

      const employeeId = getEmployeeIdFromRequest(request);

      await tx
        .update(supplierInvoices)
        .set({ status: "VERIFICADA", verifiedBy: employeeId, verifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(supplierInvoices.id, invoiceId));

      return { kind: "ok" as const };
    });

    if (result.kind === "not-found") return new Response("Factura no encontrada", { status: 404 });
    if (result.kind === "invalid-status") return new Response(`Estado inválido para verificar: ${result.status}`, { status: 422 });

    return Response.json({ ok: true });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo verificar la factura", { status: 500 });
  }
}
