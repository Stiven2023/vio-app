import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  supplierInvoices,
  supplierPayments,
  suppliers,
} from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { postSupplierPaymentEntry } from "@/src/utils/accounting-entries";

type CreateBody = {
  supplierInvoiceId?: unknown;
  paymentDate?: unknown;
  amount?: unknown;
  bankId?: unknown;
  referenceNumber?: unknown;
  paymentMethod?: unknown;
  notes?: unknown;
};

function str(value: unknown) {
  return String(value ?? "").trim();
}

function toPositiveDecimal(value: unknown): string | null {
  const num = Number(String(value ?? "").replace(/,/g, "."));

  if (!Number.isFinite(num) || num <= 0) return null;

  return num.toFixed(2);
}

function isValidDate(value: unknown): boolean {
  if (!value) return false;
  const s = String(value).trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

async function nextPaymentCode(tx: any) {
  const [row] = await tx
    .select({
      maxSuffix: sql<number>`max((substring(${supplierPayments.paymentCode} from '(?i)^PP([0-9]+)$')::int))`,
    })
    .from(supplierPayments)
    .where(sql`${supplierPayments.paymentCode} ~* '^PP[0-9]+$'`)
    .limit(1);

  const next = (row?.maxSuffix ?? 10000) + 1;

  return `PP${String(next).padStart(5, "0")}`;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, { key: "supplier-payments:get", limit: 200, windowMs: 60_000 });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PAGOS_PROVEEDOR");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? null;
    const invoiceId = searchParams.get("invoiceId") ?? null;

    const conditions = [];

    if (status) conditions.push(eq(supplierPayments.status, status));
    if (invoiceId) conditions.push(eq(supplierPayments.supplierInvoiceId, invoiceId));

    const rows = await db
      .select()
      .from(supplierPayments)
      .where(conditions.length > 0 ? conditions.reduce((a, b) => a && b) : undefined)
      .orderBy(desc(supplierPayments.createdAt));

    return Response.json({ items: rows });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar pagos", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { key: "supplier-payments:post", limit: 60, windowMs: 60_000 });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PAGO_PROVEEDOR");

  if (forbidden) return forbidden;

  try {
    const body = (await request.json().catch(() => ({}))) as CreateBody;
    const supplierInvoiceId = str(body.supplierInvoiceId);
    const paymentDate = str(body.paymentDate);
    const amount = toPositiveDecimal(body.amount);
    const paymentMethod = str(body.paymentMethod) || "TRANSFERENCIA";

    const errors: Record<string, string[]> = {};

    if (!supplierInvoiceId) errors.supplierInvoiceId = ["Factura de proveedor requerida."];
    if (!isValidDate(paymentDate)) errors.paymentDate = ["Fecha de pago inválida (YYYY-MM-DD)."];
    if (!amount) errors.amount = ["Monto inválido."];

    if (Object.keys(errors).length > 0) {
      return Response.json({ errors }, { status: 422 });
    }

    const employeeId = getEmployeeIdFromRequest(request);

    const created = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select({
          id: supplierInvoices.id,
          invoiceCode: supplierInvoices.invoiceCode,
          supplierId: supplierInvoices.supplierId,
          status: supplierInvoices.status,
        })
        .from(supplierInvoices)
        .where(eq(supplierInvoices.id, supplierInvoiceId))
        .limit(1);

      if (!invoice) return { kind: "invoice-not-found" as const };

      if (invoice.status !== "CONTABILIZADA" && invoice.status !== "APROBADA") {
        return { kind: "invalid-status" as const, status: invoice.status };
      }

      const paymentCode = await nextPaymentCode(tx);

      // Post accounting entry immediately on creation
      const entry = await postSupplierPaymentEntry(
        tx,
        {
          paymentId: paymentCode, // temporary key before DB insert, idempotency uses paymentCode
          paymentCode,
          supplierId: invoice.supplierId,
          invoiceId: invoice.id,
          invoiceCode: invoice.invoiceCode,
          paymentDate,
          amount: amount!,
          paymentMethod,
        },
        employeeId,
      );

      const [row] = await tx
        .insert(supplierPayments)
        .values({
          paymentCode,
          supplierInvoiceId,
          supplierId: invoice.supplierId,
          paymentDate,
          amount: amount!,
          bankId: str(body.bankId) || null,
          referenceNumber: str(body.referenceNumber) || null,
          status: "COMPLETADO",
          notes: str(body.notes) || null,
          accountingEntryId: entry.id,
          createdBy: employeeId,
        })
        .returning({ id: supplierPayments.id, paymentCode: supplierPayments.paymentCode });

      // Mark invoice as PAGADA
      await tx
        .update(supplierInvoices)
        .set({ status: "PAGADA", updatedAt: new Date() })
        .where(eq(supplierInvoices.id, supplierInvoiceId));

      return {
        kind: "ok" as const,
        id: row.id,
        paymentCode: row.paymentCode,
        entryNumber: entry.entryNumber,
      };
    });

    if (created.kind === "invoice-not-found") return new Response("Factura no encontrada", { status: 404 });
    if (created.kind === "invalid-status") {
      return new Response(
        `La factura debe estar APROBADA o CONTABILIZADA para pagar (estado: ${created.status})`,
        { status: 422 },
      );
    }

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo registrar el pago", { status: 500 });
  }
}
