import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { packers, clients, legalStatusRecords } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { getMissingRequiredDocumentMessage } from "@/src/utils/identification-document-rules";
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

    // Obtener el estado jurídico más reciente para cada empaquetador
    const itemsWithStatus = await Promise.all(
      items.map(async (packer) => {
        const legalStatus = await db.query.legalStatusRecords.findFirst({
          where: (record, { eq, and }) =>
            and(
              eq(record.thirdPartyId, packer.id),
              eq(record.thirdPartyType, "EMPAQUE"),
            ),
          orderBy: (record, { desc }) => desc(record.createdAt),
        });

        const isActiveByLegalStatus =
          legalStatus?.status === "VIGENTE"
            ? true
            : legalStatus?.status
              ? false
              : packer.isActive;

        return {
          ...packer,
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

    const missingDocumentError = getMissingRequiredDocumentMessage(
      String(mergedPayload.identificationType ?? ""),
      mergedPayload as Record<string, unknown>,
    );

    if (missingDocumentError) {
      return new Response(missingDocumentError, { status: 400 });
    }

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

    const newPackerId = created[0]?.id;

    // Crear registro de estado jurídico iniciando con EN_REVISION
    if (newPackerId) {
      await db.insert(legalStatusRecords).values({
        thirdPartyId: newPackerId,
        thirdPartyType: "EMPAQUE",
        thirdPartyName: name,
        status: "EN_REVISION",
        notes: "Estado inicial al crear empaquetador",
      });
    }

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
    const currentPacker = await db
      .select()
      .from(packers)
      .where(eq(packers.id, String(id)))
      .limit(1);

    if (currentPacker.length === 0) {
      return new Response("Empaquetador no encontrado", { status: 404 });
    }

    const packer = currentPacker[0];

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
      const key = field as keyof typeof packer;
      const patchValue = patch[key as keyof Partial<typeof packers.$inferInsert>];

      if (patchValue !== undefined && packer[key] !== patchValue) {
        changedFields.push(field);
      }
    }

    // Si hay cambios críticos, crear EN_REVISION automáticamente
    if (changedFields.length > 0) {
      patch.isActive = false;

      // Crear registro de estado jurídico EN_REVISION
      await db.insert(legalStatusRecords).values({
        thirdPartyId: String(id),
        thirdPartyType: "EMPAQUE",
        thirdPartyName: packer.name,
        status: "EN_REVISION",
        notes: `Cambios detectados: ${changedFields.join(", ")}`,
      });
    }

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
