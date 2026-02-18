import { eq, sql, desc } from "drizzle-orm";

import { db } from "@/src/db";
import { suppliers } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import type { SupplierFormPrefill } from "./supplier-modal.types";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "suppliers:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PROVEEDOR");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(suppliers);

    const items = await db
      .select()
      .from(suppliers)
      .limit(pageSize)
      .offset(offset);
    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar proveedores", { status: 500 });
  }
}

// Helper function to generate supplier code
async function generateSupplierCode(): Promise<string> {
  const lastSupplier = await db
    .select()
    .from(suppliers)
    .orderBy(desc(suppliers.supplierCode))
    .limit(1);

  if (!lastSupplier.length) {
    return "PROV1001";
  }

  const lastCode = lastSupplier[0].supplierCode || "PROV1000";
  const numberPart = parseInt(lastCode.replace("PROV", ""));
  const nextNumber = numberPart + 1;
  return `PROV${String(nextNumber).padStart(4, "0")}`;
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "suppliers:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_PROVEEDOR");

  if (forbidden) return forbidden;

  const body: SupplierFormPrefill = await request.json();

  const n = String(body.name ?? "").trim();

  if (!n) {
    return new Response("Nombre requerido", { status: 400 });
  }

  if (!body.identification) {
    return new Response("Identificación requerida", { status: 400 });
  }

  if (!body.contactName) {
    return new Response("Nombre de contacto requerido", { status: 400 });
  }

  if (!body.email) {
    return new Response("Email requerido", { status: 400 });
  }

  if (!body.address) {
    return new Response("Dirección requerida", { status: 400 });
  }

  // Generate supplier code
  const supplierCode = await generateSupplierCode();

  const created = await db
    .insert(suppliers)
    .values({
      supplierCode,
      name: n,
      identificationType: body.identificationType || "NIT",
      identification: body.identification,
      dv: body.dv,
      branch: body.branch || "01",
      taxRegime: body.taxRegime || "REGIMEN_COMUN",
      contactName: body.contactName,
      email: body.email,
      address: body.address,
      postalCode: body.postalCode,
      country: body.country || "COLOMBIA",
      department: body.department || "ANTIOQUIA",
      city: body.city || "Medellín",
      intlDialCode: body.intlDialCode || "57",
      mobile: body.mobile,
      fullMobile: body.fullMobile,
      localDialCode: body.localDialCode,
      landline: body.landline,
      extension: body.extension,
      fullLandline: body.fullLandline,
      isActive: true,
      hasCredit: body.hasCredit || false,
      promissoryNoteNumber: body.promissoryNoteNumber,
      promissoryNoteDate: body.promissoryNoteDate
        ? new Date(body.promissoryNoteDate).toISOString()
        : undefined,
    })
    .returning();

  return Response.json(created, { status: 201 });
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "suppliers:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PROVEEDOR");

  if (forbidden) return forbidden;

  const body = await request.json();
  const { id, ...data } = body;

  if (!id) {
    return new Response("Supplier ID required", { status: 400 });
  }

  // Build update object - only update fields that are provided
  const patch: Partial<typeof suppliers.$inferInsert> = {};

  // Required notNull fields - only update if provided
  if (data.name !== undefined) patch.name = String(data.name).trim();
  if (data.identificationType !== undefined)
    patch.identificationType = data.identificationType;
  if (data.identification !== undefined)
    patch.identification = String(data.identification).trim();
  if (data.taxRegime !== undefined) patch.taxRegime = data.taxRegime;
  if (data.contactName !== undefined)
    patch.contactName = String(data.contactName).trim();
  if (data.email !== undefined) patch.email = String(data.email).trim();
  if (data.address !== undefined)
    patch.address = String(data.address).trim();

  // Optional fields
  if (data.dv !== undefined) patch.dv = data.dv ? String(data.dv).trim() : null;
  if (data.branch !== undefined)
    patch.branch = data.branch ? String(data.branch).trim() : "01";
  if (data.postalCode !== undefined)
    patch.postalCode = data.postalCode ? String(data.postalCode).trim() : null;
  if (data.country !== undefined)
    patch.country = data.country ? String(data.country).trim() : "COLOMBIA";
  if (data.department !== undefined)
    patch.department = data.department
      ? String(data.department).trim()
      : "ANTIOQUIA";
  if (data.city !== undefined)
    patch.city = data.city ? String(data.city).trim() : "Medellín";
  if (data.intlDialCode !== undefined)
    patch.intlDialCode = data.intlDialCode
      ? String(data.intlDialCode).trim()
      : "57";
  if (data.mobile !== undefined)
    patch.mobile = data.mobile ? String(data.mobile).trim() : null;
  if (data.fullMobile !== undefined)
    patch.fullMobile = data.fullMobile ? String(data.fullMobile).trim() : null;
  if (data.localDialCode !== undefined)
    patch.localDialCode = data.localDialCode
      ? String(data.localDialCode).trim()
      : null;
  if (data.landline !== undefined)
    patch.landline = data.landline ? String(data.landline).trim() : null;
  if (data.extension !== undefined)
    patch.extension = data.extension ? String(data.extension).trim() : null;
  if (data.fullLandline !== undefined)
    patch.fullLandline = data.fullLandline
      ? String(data.fullLandline).trim()
      : null;
  if (data.isActive !== undefined) patch.isActive = data.isActive;
  if (data.hasCredit !== undefined) patch.hasCredit = data.hasCredit;
  if (data.promissoryNoteNumber !== undefined)
    patch.promissoryNoteNumber = data.promissoryNoteNumber
      ? String(data.promissoryNoteNumber).trim()
      : null;
  if (data.promissoryNoteDate !== undefined)
    patch.promissoryNoteDate = data.promissoryNoteDate
      ? new Date(data.promissoryNoteDate).toISOString()
      : null;

  const updated = await db
    .update(suppliers)
    .set(patch)
    .where(eq(suppliers.id, String(id)))
    .returning();

  return Response.json(updated);
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "suppliers:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_PROVEEDOR");

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id) {
    return new Response("Supplier ID required", { status: 400 });
  }

  const deleted = await db
    .delete(suppliers)
    .where(eq(suppliers.id, String(id)))
    .returning();

  return Response.json(deleted);
}

