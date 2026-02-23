import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { confectionists, clients, legalStatusRecords } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "confectionists:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CONFECCIONISTA");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);

    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(confectionists);

    const items = await db
      .select()
      .from(confectionists)
      .orderBy(confectionists.createdAt)
      .limit(pageSize)
      .offset(offset);

    // Obtener el estado jurídico más reciente para cada confeccionista
    const itemsWithStatus = await Promise.all(
      items.map(async (confectionist) => {
        const legalStatus = await db.query.legalStatusRecords.findFirst({
          where: (record, { eq, and }) =>
            and(
              eq(record.thirdPartyId, confectionist.id),
              eq(record.thirdPartyType, "CONFECCIONISTA"),
            ),
          orderBy: (record, { desc }) => desc(record.createdAt),
        });

        const isActiveByLegalStatus =
          legalStatus?.status === "VIGENTE"
            ? true
            : legalStatus?.status
              ? false
              : confectionist.isActive;

        return {
          ...confectionist,
          isActive: isActiveByLegalStatus,
          legalStatus: legalStatus?.status ?? null,
        };
      }),
    );

    const hasNextPage = offset + items.length < total;

    return Response.json({
      items: itemsWithStatus,
      page,
      pageSize,
      total,
      hasNextPage,
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar confeccionistas", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "confectionists:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_CONFECCIONISTA");

  if (forbidden) return forbidden;

  const payload = await request.json();

  const name = String(payload.name ?? "").trim();
  const identificationType = String(payload.identificationType ?? "").trim();
  const identification = String(payload.identification ?? "").trim();
  const taxRegime = String(payload.taxRegime ?? "").trim();
  const address = String(payload.address ?? "").trim();

  if (!name || !identificationType || !identification || !taxRegime || !address) {
    return new Response(
      "name, identificationType, identification, taxRegime y address son requeridos",
      { status: 400 },
    );
  }

  try {
    // Generar confectionistCode autoincrementado
    const lastConfectionist = await db
      .select({ confectionistCode: confectionists.confectionistCode })
      .from(confectionists)
      .orderBy(sql`${confectionists.confectionistCode} DESC`)
      .limit(1);

    let nextNumber = 1001;
    if (
      lastConfectionist.length > 0 &&
      lastConfectionist[0]?.confectionistCode
    ) {
      const lastCode = lastConfectionist[0].confectionistCode;
      const lastNumber = parseInt(lastCode.replace(/^CON/i, ""), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const confectionistCode = `CON${nextNumber}`;

    // Obtener documentos del cliente si se proporciona clientId (para conversiones)
    let sourceClientDocuments: {
      identityDocumentUrl: string | null;
      rutDocumentUrl: string | null;
      commerceChamberDocumentUrl: string | null;
      passportDocumentUrl: string | null;
      taxCertificateDocumentUrl: string | null;
      companyIdDocumentUrl: string | null;
    } = {
      identityDocumentUrl: null,
      rutDocumentUrl: null,
      commerceChamberDocumentUrl: null,
      passportDocumentUrl: null,
      taxCertificateDocumentUrl: null,
      companyIdDocumentUrl: null,
    };

    if (payload.clientId) {
      const sourceClient = await db
        .select()
        .from(clients)
        .where(eq(clients.id, String(payload.clientId)))
        .limit(1);

      if (sourceClient.length > 0) {
        const client = sourceClient[0];
        sourceClientDocuments = {
          identityDocumentUrl: client.identityDocumentUrl,
          rutDocumentUrl: client.rutDocumentUrl,
          commerceChamberDocumentUrl: client.commerceChamberDocumentUrl,
          passportDocumentUrl: client.passportDocumentUrl,
          taxCertificateDocumentUrl: client.taxCertificateDocumentUrl,
          companyIdDocumentUrl: client.companyIdDocumentUrl,
        };
      }
    }

    const mergedPayload = {
      ...payload,
      identityDocumentUrl:
        payload.identityDocumentUrl || sourceClientDocuments.identityDocumentUrl,
      rutDocumentUrl: payload.rutDocumentUrl || sourceClientDocuments.rutDocumentUrl,
      commerceChamberDocumentUrl:
        payload.commerceChamberDocumentUrl ||
        sourceClientDocuments.commerceChamberDocumentUrl,
      passportDocumentUrl:
        payload.passportDocumentUrl || sourceClientDocuments.passportDocumentUrl,
      taxCertificateDocumentUrl:
        payload.taxCertificateDocumentUrl ||
        sourceClientDocuments.taxCertificateDocumentUrl,
      companyIdDocumentUrl:
        payload.companyIdDocumentUrl || sourceClientDocuments.companyIdDocumentUrl,
    };

    const created = await db
      .insert(confectionists)
      .values({
        confectionistCode,
        name,
        identificationType: identificationType as
          | "CC"
          | "NIT"
          | "CE"
          | "PAS"
          | "EMPRESA_EXTERIOR",
        identification,
        dv: payload.dv ? String(payload.dv).trim() : null,
        type: payload.type ? String(payload.type).trim() : null,
        specialty: payload.specialty ? String(payload.specialty).trim() : null,
        taxRegime: taxRegime as
          | "REGIMEN_COMUN"
          | "REGIMEN_SIMPLIFICADO"
          | "NO_RESPONSABLE",
        contactName: payload.contactName
          ? String(payload.contactName).trim()
          : null,
        email: payload.email ? String(payload.email).trim() : null,
        intlDialCode: payload.intlDialCode
          ? String(payload.intlDialCode).trim()
          : "57",
        mobile: payload.mobile ? String(payload.mobile).trim() : null,
        fullMobile: payload.fullMobile
          ? String(payload.fullMobile).trim()
          : null,
        landline: payload.landline ? String(payload.landline).trim() : null,
        extension: payload.extension ? String(payload.extension).trim() : null,
        address,
        postalCode: payload.postalCode
          ? String(payload.postalCode).trim()
          : null,
        country: payload.country
          ? String(payload.country).trim()
          : "COLOMBIA",
        department: payload.department
          ? String(payload.department).trim()
          : "ANTIOQUIA",
        city: payload.city ? String(payload.city).trim() : "Medellín",
        isActive: false,
        dailyCapacity:
          payload.dailyCapacity === "" || payload.dailyCapacity === null
            ? null
            : Number(payload.dailyCapacity),
        // Documentos del formulario o copiados del cliente
        identityDocumentUrl: mergedPayload.identityDocumentUrl,
        rutDocumentUrl: mergedPayload.rutDocumentUrl,
        commerceChamberDocumentUrl: mergedPayload.commerceChamberDocumentUrl,
        passportDocumentUrl: mergedPayload.passportDocumentUrl,
        taxCertificateDocumentUrl: mergedPayload.taxCertificateDocumentUrl,
        companyIdDocumentUrl: mergedPayload.companyIdDocumentUrl,
      })
      .returning();

    const newConfectionistId = created[0]?.id;

    // Crear registro de estado jurídico iniciando con EN_REVISION
    if (newConfectionistId) {
      await db.insert(legalStatusRecords).values({
        thirdPartyId: newConfectionistId,
        thirdPartyType: "CONFECCIONISTA",
        thirdPartyName: name,
        status: "EN_REVISION",
        notes: "Estado inicial al crear confeccionista",
      });
    }

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo crear confeccionista", { status: 500 });
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "confectionists:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_CONFECCIONISTA");

  if (forbidden) return forbidden;

  const payload = await request.json();
  const { id } = payload;

  if (!id) {
    return new Response("Confectionist ID required", { status: 400 });
  }

  const patch: Partial<typeof confectionists.$inferInsert> = {};

  // Campos obligatorios (.notNull()): solo actualizar si tienen valor
  if (payload.name !== undefined && String(payload.name).trim()) 
    patch.name = String(payload.name).trim();
  if (payload.identificationType !== undefined && String(payload.identificationType).trim())
    patch.identificationType = String(payload.identificationType).trim() as
      | "CC"
      | "NIT"
      | "CE"
      | "PAS"
      | "EMPRESA_EXTERIOR";
  if (payload.identification !== undefined && String(payload.identification).trim())
    patch.identification = String(payload.identification).trim();
  if (payload.taxRegime !== undefined && String(payload.taxRegime).trim())
    patch.taxRegime = String(payload.taxRegime).trim() as
      | "REGIMEN_COMUN"
      | "REGIMEN_SIMPLIFICADO"
      | "NO_RESPONSABLE";
  if (payload.address !== undefined && String(payload.address).trim())
    patch.address = String(payload.address).trim();

  // Campos opcionales: pueden ser null
  if (payload.dv !== undefined)
    patch.dv = payload.dv ? String(payload.dv).trim() : null;
  if (payload.type !== undefined)
    patch.type = payload.type ? String(payload.type).trim() : null;
  if (payload.specialty !== undefined)
    patch.specialty = payload.specialty ? String(payload.specialty).trim() : null;
  if (payload.contactName !== undefined)
    patch.contactName = payload.contactName
      ? String(payload.contactName).trim()
      : null;
  if (payload.email !== undefined)
    patch.email = payload.email ? String(payload.email).trim() : null;
  if (payload.intlDialCode !== undefined)
    patch.intlDialCode = payload.intlDialCode
      ? String(payload.intlDialCode).trim()
      : null;
  if (payload.mobile !== undefined)
    patch.mobile = payload.mobile ? String(payload.mobile).trim() : null;
  if (payload.fullMobile !== undefined)
    patch.fullMobile = payload.fullMobile
      ? String(payload.fullMobile).trim()
      : null;
  if (payload.landline !== undefined)
    patch.landline = payload.landline ? String(payload.landline).trim() : null;
  if (payload.extension !== undefined)
    patch.extension = payload.extension
      ? String(payload.extension).trim()
      : null;
  if (payload.postalCode !== undefined)
    patch.postalCode = payload.postalCode
      ? String(payload.postalCode).trim()
      : null;
  if (payload.country !== undefined)
    patch.country = payload.country ? String(payload.country).trim() : null;
  if (payload.department !== undefined)
    patch.department = payload.department
      ? String(payload.department).trim()
      : null;
  if (payload.city !== undefined)
    patch.city = payload.city ? String(payload.city).trim() : null;
  patch.isActive = false;
  if (payload.dailyCapacity !== undefined)
    patch.dailyCapacity =
      payload.dailyCapacity === "" || payload.dailyCapacity === null
        ? null
        : Number(payload.dailyCapacity);

  // Manejar campos de documentos
  if (payload.identityDocumentUrl !== undefined)
    patch.identityDocumentUrl = payload.identityDocumentUrl
      ? String(payload.identityDocumentUrl).trim()
      : null;
  if (payload.rutDocumentUrl !== undefined)
    patch.rutDocumentUrl = payload.rutDocumentUrl
      ? String(payload.rutDocumentUrl).trim()
      : null;
  if (payload.commerceChamberDocumentUrl !== undefined)
    patch.commerceChamberDocumentUrl = payload.commerceChamberDocumentUrl
      ? String(payload.commerceChamberDocumentUrl).trim()
      : null;
  if (payload.passportDocumentUrl !== undefined)
    patch.passportDocumentUrl = payload.passportDocumentUrl
      ? String(payload.passportDocumentUrl).trim()
      : null;
  if (payload.taxCertificateDocumentUrl !== undefined)
    patch.taxCertificateDocumentUrl = payload.taxCertificateDocumentUrl
      ? String(payload.taxCertificateDocumentUrl).trim()
      : null;
  if (payload.companyIdDocumentUrl !== undefined)
    patch.companyIdDocumentUrl = payload.companyIdDocumentUrl
      ? String(payload.companyIdDocumentUrl).trim()
      : null;

  try {
    const currentConfectionist = await db
      .select()
      .from(confectionists)
      .where(eq(confectionists.id, String(id)))
      .limit(1);

    if (currentConfectionist.length === 0) {
      return new Response("Confeccionista no encontrado", { status: 404 });
    }

    const confectionist = currentConfectionist[0];

    // Detectar cambios críticos
    const criticalFields = [
      "name",
      "identification",
      "identificationType",
      "identityDocumentUrl",
      "rutDocumentUrl",
      "commerceChamberDocumentUrl",
      "passportDocumentUrl",
      "taxCertificateDocumentUrl",
      "companyIdDocumentUrl",
    ];

    const changedFields: string[] = [];
    for (const field of criticalFields) {
      const key = field as keyof typeof confectionist;
      const patchValue =
        patch[key as keyof Partial<typeof confectionists.$inferInsert>];

      if (patchValue !== undefined && confectionist[key] !== patchValue) {
        changedFields.push(field);
      }
    }

    // Si hay cambios críticos, crear EN_REVISION automáticamente
    if (changedFields.length > 0) {
      patch.isActive = false;

      // Crear registro de estado jurídico EN_REVISION
      await db.insert(legalStatusRecords).values({
        thirdPartyId: String(id),
        thirdPartyType: "CONFECCIONISTA",
        thirdPartyName: confectionist.name,
        status: "EN_REVISION",
        notes: `Cambios detectados: ${changedFields.join(", ")}`,
      });
    }

    const updated = await db
      .update(confectionists)
      .set(patch)
      .where(eq(confectionists.id, String(id)))
      .returning();

    return Response.json(updated);
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo actualizar confeccionista", {
      status: 500,
    });
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "confectionists:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_CONFECCIONISTA");

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id) {
    return new Response("Confectionist ID required", { status: 400 });
  }

  const deleted = await db
    .delete(confectionists)
    .where(eq(confectionists.id, String(id)))
    .returning();

  return Response.json(deleted);
}
