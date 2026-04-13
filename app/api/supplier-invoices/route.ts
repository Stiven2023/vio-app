import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  purchaseOrderReceipts,
  purchaseOrders,
  supplierInvoices,
  suppliers,
} from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { calculateLegalDiscounts } from "@/src/utils/legal-discounts";
import {
  createSupplierInvoiceSchema,
  type CreateSupplierInvoiceInput,
} from "@/src/utils/supplier-invoices-contract";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";


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
        documentType: supplierInvoices.documentType,
        siigoStatus: supplierInvoices.siigoStatus,
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
    const body = (await request.json().catch(() => ({}))) as unknown;

    // Validate with the new Zod schema
    const parsed = createSupplierInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      return zodFirstErrorEnvelope(
        parsed.error,
        "Datos de factura de proveedor inválidos."
      );
    }

    const input = parsed.data as CreateSupplierInvoiceInput;
    const employeeId = getEmployeeIdFromRequest(request);

    const created = await db.transaction(async (tx) => {
      // Verify supplier and PO exist
      const [supplier] = await tx
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.id, input.supplierId))
        .limit(1);

      if (!supplier) return { kind: "supplier-not-found" as const };

      const [po] = await tx
        .select({ id: purchaseOrders.id })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, input.purchaseOrderId))
        .limit(1);

      if (!po) return { kind: "po-not-found" as const };

      // Verify receipt if provided
      if (input.purchaseOrderReceiptId) {
        const [receipt] = await tx
          .select({ id: purchaseOrderReceipts.id })
          .from(purchaseOrderReceipts)
          .where(eq(purchaseOrderReceipts.id, input.purchaseOrderReceiptId))
          .limit(1);

        if (!receipt) return { kind: "receipt-not-found" as const };
      }

      const invoiceCode = await nextInvoiceCode(tx);

      // ── Compute tax amounts ──────────────────────────────────────
      let ivaAmount: string;
      let withholdingTax: string;
      let withholdingIva: string;
      let withholdingIca: string;

      if (input.operationType && input.customerProfile) {
        // OPCIÓN A: Auto-calculate using legal discounts motor
        const legalDiscounts = calculateLegalDiscounts({
          subtotal: Number(input.subtotal),
          ivaRate: input.ivaRate ?? 19,
          operationType: input.operationType,
          customerProfile: input.customerProfile,
          reteIcaRate: 0.966,
          reteIvaRate: 15,
          stampRate: 1.5,
          contractRequiresStamps: false,
        });

        ivaAmount = legalDiscounts.ivaAmount;
        withholdingTax = legalDiscounts.discounts.reteFuente;
        withholdingIva = legalDiscounts.discounts.reteIva;
        withholdingIca = legalDiscounts.discounts.reteIca;
      } else {
        // OPCIÓN B: Use manually provided values (backward compatibility)
        ivaAmount = toNonNegativeDecimal(input.ivaAmount ?? 0);
        withholdingTax = toNonNegativeDecimal(input.withholdingTax ?? 0);
        withholdingIva = toNonNegativeDecimal(input.withholdingIva ?? 0);
        withholdingIca = toNonNegativeDecimal(input.withholdingIca ?? 0);
      }

      // Calculate total: subtotal + IVA - withholdingTax - withholdingIva - withholdingIca
      const subtotalNum = Number(input.subtotal);
      const ivaNum = Number(ivaAmount);
      const withTaxNum = Number(withholdingTax);
      const withIvaNum = Number(withholdingIva);
      const withIcaNum = Number(withholdingIca);

      const total = (
        subtotalNum +
        ivaNum -
        withTaxNum -
        withIvaNum -
        withIcaNum
      ).toFixed(2);

      const [row] = await tx
        .insert(supplierInvoices)
        .values({
          invoiceCode,
          supplierId: input.supplierId,
          purchaseOrderId: input.purchaseOrderId,
          purchaseOrderReceiptId: input.purchaseOrderReceiptId || null,
          supplierInvoiceNumber: input.supplierInvoiceNumber || null,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate || null,
          currency: input.currency || "COP",
          subtotal: Number(input.subtotal).toFixed(2),
          ivaAmount,
          withholdingTax,
          withholdingIva,
          withholdingIca,
          total,
          status: "RECIBIDA",
          notes: input.notes || null,
          documentUrl: input.documentUrl || null,
          createdBy: employeeId,
        })
        .returning({
          id: supplierInvoices.id,
          invoiceCode: supplierInvoices.invoiceCode,
        });

      return { kind: "ok" as const, id: row.id, invoiceCode: row.invoiceCode };
    });

    if (created.kind === "supplier-not-found") {
      return jsonError(404, "NOT_FOUND", "Proveedor no encontrado.");
    }
    if (created.kind === "po-not-found") {
      return jsonError(404, "NOT_FOUND", "Orden de compra no encontrada.");
    }
    if (created.kind === "receipt-not-found") {
      return jsonError(404, "NOT_FOUND", "Recibo de compra no encontrado.");
    }

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo crear la factura", { status: 500 });
  }
}
