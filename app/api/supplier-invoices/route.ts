import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  purchaseOrderReceipts,
  purchaseOrders,
  supplierInvoices,
  suppliers,
} from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type CreateBody = {
  supplierId?: unknown;
  purchaseOrderId?: unknown;
  purchaseOrderReceiptId?: unknown;
  supplierInvoiceNumber?: unknown;
  invoiceDate?: unknown;
  dueDate?: unknown;
  currency?: unknown;
  subtotal?: unknown;
  ivaAmount?: unknown;
  withholdingTax?: unknown;
  withholdingIva?: unknown;
  withholdingIca?: unknown;
  total?: unknown;
  notes?: unknown;
  documentUrl?: unknown;
};

function str(value: unknown) {
  return String(value ?? "").trim();
}

function toNonNegativeDecimal(value: unknown): string {
  const num = Number(String(value ?? "0").replace(/,/g, "."));

  return Number.isFinite(num) && num >= 0 ? num.toFixed(2) : "0.00";
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

async function nextInvoiceCode(tx: any) {
  const [row] = await tx
    .select({
      maxSuffix: sql<number>`max((substring(${supplierInvoices.invoiceCode} from '(?i)^FP([0-9]+)$')::int))`,
    })
    .from(supplierInvoices)
    .where(sql`${supplierInvoices.invoiceCode} ~* '^FP[0-9]+$'`)
    .limit(1);

  const next = (row?.maxSuffix ?? 10000) + 1;

  return `FP${String(next).padStart(5, "0")}`;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "supplier-invoices:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_FACTURAS_PROVEEDOR");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? null;
    const supplierId = searchParams.get("supplierId") ?? null;

    const conditions = [];

    if (status) conditions.push(eq(supplierInvoices.status, status));
    if (supplierId) conditions.push(eq(supplierInvoices.supplierId, supplierId));

    const rows = await db
      .select({
        id: supplierInvoices.id,
        invoiceCode: supplierInvoices.invoiceCode,
        supplierId: supplierInvoices.supplierId,
        supplierName: suppliers.name,
        purchaseOrderId: supplierInvoices.purchaseOrderId,
        purchaseOrderReceiptId: supplierInvoices.purchaseOrderReceiptId,
        supplierInvoiceNumber: supplierInvoices.supplierInvoiceNumber,
        invoiceDate: supplierInvoices.invoiceDate,
        dueDate: supplierInvoices.dueDate,
        subtotal: supplierInvoices.subtotal,
        ivaAmount: supplierInvoices.ivaAmount,
        withholdingTax: supplierInvoices.withholdingTax,
        withholdingIva: supplierInvoices.withholdingIva,
        withholdingIca: supplierInvoices.withholdingIca,
        total: supplierInvoices.total,
        status: supplierInvoices.status,
        createdAt: supplierInvoices.createdAt,
      })
      .from(supplierInvoices)
      .leftJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
      .where(conditions.length > 0 ? conditions.reduce((a, b) => a && b) : undefined)
      .orderBy(desc(supplierInvoices.createdAt));

    return Response.json({ items: rows });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar facturas", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "supplier-invoices:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_FACTURA_PROVEEDOR");

  if (forbidden) return forbidden;

  try {
    const body = (await request.json().catch(() => ({}))) as CreateBody;
    const supplierId = str(body.supplierId);
    const purchaseOrderId = str(body.purchaseOrderId);
    const invoiceDate = str(body.invoiceDate);
    const total = toPositiveDecimal(body.total);

    const errors: Record<string, string[]> = {};

    if (!supplierId) errors.supplierId = ["Proveedor requerido."];
    if (!purchaseOrderId) errors.purchaseOrderId = ["Orden de compra requerida."];
    if (!isValidDate(invoiceDate)) errors.invoiceDate = ["Fecha de factura inválida (YYYY-MM-DD)."];
    if (!total) errors.total = ["Total inválido."];

    if (Object.keys(errors).length > 0) {
      return Response.json({ errors }, { status: 422 });
    }

    const employeeId = getEmployeeIdFromRequest(request);

    const created = await db.transaction(async (tx) => {
      // Verify supplier and PO exist
      const [supplier] = await tx
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1);

      if (!supplier) return { kind: "supplier-not-found" as const };

      const [po] = await tx
        .select({ id: purchaseOrders.id })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, purchaseOrderId))
        .limit(1);

      if (!po) return { kind: "po-not-found" as const };

      // Verify receipt if provided
      const purchaseOrderReceiptId = str(body.purchaseOrderReceiptId) || null;

      if (purchaseOrderReceiptId) {
        const [receipt] = await tx
          .select({ id: purchaseOrderReceipts.id })
          .from(purchaseOrderReceipts)
          .where(eq(purchaseOrderReceipts.id, purchaseOrderReceiptId))
          .limit(1);

        if (!receipt) return { kind: "receipt-not-found" as const };
      }

      const invoiceCode = await nextInvoiceCode(tx);
      const subtotal = toNonNegativeDecimal(body.subtotal);
      const ivaAmount = toNonNegativeDecimal(body.ivaAmount);
      const withholdingTax = toNonNegativeDecimal(body.withholdingTax);
      const withholdingIva = toNonNegativeDecimal(body.withholdingIva);
      const withholdingIca = toNonNegativeDecimal(body.withholdingIca);

      const [row] = await tx
        .insert(supplierInvoices)
        .values({
          invoiceCode,
          supplierId,
          purchaseOrderId,
          purchaseOrderReceiptId,
          supplierInvoiceNumber: str(body.supplierInvoiceNumber) || null,
          invoiceDate,
          dueDate: isValidDate(body.dueDate) ? str(body.dueDate) : null,
          currency: str(body.currency) || "COP",
          subtotal,
          ivaAmount,
          withholdingTax,
          withholdingIva,
          withholdingIca,
          total: total!,
          status: "RECIBIDA",
          notes: str(body.notes) || null,
          documentUrl: str(body.documentUrl) || null,
          createdBy: employeeId,
        })
        .returning({
          id: supplierInvoices.id,
          invoiceCode: supplierInvoices.invoiceCode,
        });

      return { kind: "ok" as const, id: row.id, invoiceCode: row.invoiceCode };
    });

    if (created.kind === "supplier-not-found") return new Response("Proveedor no encontrado", { status: 404 });
    if (created.kind === "po-not-found") return new Response("Orden de compra no encontrada", { status: 404 });
    if (created.kind === "receipt-not-found") return new Response("Recibo no encontrado", { status: 404 });

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo crear la factura", { status: 500 });
  }
}
