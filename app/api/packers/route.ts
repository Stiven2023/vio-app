import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { packers } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

async function generatePackerCode(): Promise<string> {
  const [last] = await db
    .select({ code: packers.packerCode })
    .from(packers)
    .orderBy(sql`${packers.packerCode} DESC`)
    .limit(1);

  let nextNumber = 1001;

  if (last?.code) {
    const parsed = Number.parseInt(last.code.replace(/^EMPA/i, ""), 10);
    if (!Number.isNaN(parsed)) nextNumber = parsed + 1;
  }

  return `EMPA${nextNumber}`;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "packers:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_EMPAQUE");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(packers);

    const items = await db
      .select()
      .from(packers)
      .orderBy(packers.createdAt)
      .limit(pageSize)
      .offset(offset);

    const hasNextPage = offset + items.length < total;

    return Response.json({ items, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar empaque", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "packers:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_EMPAQUE");

  if (forbidden) return forbidden;

  const payload = await request.json();

  const name = String(payload.name ?? "").trim();
  const identificationType = String(payload.identificationType ?? "").trim();
  const identification = String(payload.identification ?? "").trim();
  const address = String(payload.address ?? "").trim();

  if (!name || !identificationType || !identification || !address) {
    return new Response(
      "name, identificationType, identification y address son requeridos",
      { status: 400 },
    );
  }

  try {
    const packerCode = await generatePackerCode();

    const created = await db
      .insert(packers)
      .values({
        packerCode,
        name,
        identificationType: identificationType as
          | "CC"
          | "NIT"
          | "CE"
          | "PAS"
          | "EMPRESA_EXTERIOR",
        identification,
        dv: payload.dv ? String(payload.dv).trim() : null,
        packerType: payload.packerType ? String(payload.packerType).trim() : null,
        specialty: payload.specialty ? String(payload.specialty).trim() : null,
        contactName: payload.contactName
          ? String(payload.contactName).trim()
          : null,
        email: payload.email ? String(payload.email).trim() : null,
        intlDialCode: payload.intlDialCode
          ? String(payload.intlDialCode).trim()
          : "57",
        mobile: payload.mobile ? String(payload.mobile).trim() : null,
        fullMobile: payload.fullMobile ? String(payload.fullMobile).trim() : null,
        landline: payload.landline ? String(payload.landline).trim() : null,
        address,
        postalCode: payload.postalCode ? String(payload.postalCode).trim() : null,
        city: payload.city ? String(payload.city).trim() : "Medellín",
        department: payload.department
          ? String(payload.department).trim()
          : "ANTIOQUIA",
        isActive: payload.isActive ?? true,
        dailyCapacity:
          payload.dailyCapacity === "" || payload.dailyCapacity === null
            ? null
            : Number(payload.dailyCapacity),
      })
      .returning();

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo crear empaque", { status: 500 });
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "packers:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_EMPAQUE");

  if (forbidden) return forbidden;

  const payload = await request.json();
  const { id } = payload;

  if (!id) {
    return new Response("Packer ID required", { status: 400 });
  }

  const patch: Partial<typeof packers.$inferInsert> = {};

  if (payload.name !== undefined && String(payload.name).trim()) {
    patch.name = String(payload.name).trim();
  }

  if (payload.identificationType !== undefined && String(payload.identificationType).trim()) {
    patch.identificationType = String(payload.identificationType).trim() as
      | "CC"
      | "NIT"
      | "CE"
      | "PAS"
      | "EMPRESA_EXTERIOR";
  }

  if (payload.identification !== undefined && String(payload.identification).trim()) {
    patch.identification = String(payload.identification).trim();
  }

  if (payload.address !== undefined && String(payload.address).trim()) {
    patch.address = String(payload.address).trim();
  }

  if (payload.dv !== undefined) patch.dv = payload.dv ? String(payload.dv).trim() : null;
  if (payload.packerType !== undefined)
    patch.packerType = payload.packerType ? String(payload.packerType).trim() : null;
  if (payload.specialty !== undefined)
    patch.specialty = payload.specialty ? String(payload.specialty).trim() : null;
  if (payload.contactName !== undefined)
    patch.contactName = payload.contactName ? String(payload.contactName).trim() : null;
  if (payload.email !== undefined)
    patch.email = payload.email ? String(payload.email).trim() : null;
  if (payload.intlDialCode !== undefined)
    patch.intlDialCode = payload.intlDialCode ? String(payload.intlDialCode).trim() : null;
  if (payload.mobile !== undefined)
    patch.mobile = payload.mobile ? String(payload.mobile).trim() : null;
  if (payload.fullMobile !== undefined)
    patch.fullMobile = payload.fullMobile ? String(payload.fullMobile).trim() : null;
  if (payload.landline !== undefined)
    patch.landline = payload.landline ? String(payload.landline).trim() : null;
  if (payload.postalCode !== undefined)
    patch.postalCode = payload.postalCode ? String(payload.postalCode).trim() : null;
  if (payload.city !== undefined)
    patch.city = payload.city ? String(payload.city).trim() : null;
  if (payload.department !== undefined)
    patch.department = payload.department ? String(payload.department).trim() : null;
  if (payload.isActive !== undefined) patch.isActive = Boolean(payload.isActive);
  if (payload.dailyCapacity !== undefined)
    patch.dailyCapacity =
      payload.dailyCapacity === "" || payload.dailyCapacity === null
        ? null
        : Number(payload.dailyCapacity);

  try {
    const updated = await db
      .update(packers)
      .set(patch)
      .where(eq(packers.id, String(id)))
      .returning();

    return Response.json(updated);
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo actualizar empaque", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "packers:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_EMPAQUE");

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id) {
    return new Response("Packer ID required", { status: 400 });
  }

  const deleted = await db
    .delete(packers)
    .where(eq(packers.id, String(id)))
    .returning();

  return Response.json(deleted);
}
