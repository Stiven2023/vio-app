import { eq, sql, desc } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, employees, clientLegalStatusHistory } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import { syncClientLegalStatusWithIsActive } from "@/app/admin/_lib/sync-client-legal-status";
import { detectCriticalFieldChanges, registerAutoRevisionOnClientChange } from "@/app/admin/_lib/sync-client-legal-status";
import { validateRequiredDocuments } from "@/app/admin/_lib/client-document-requirements";

/**
 * Formatea un número de teléfono móvil con código internacional
 * @example formatMobile("57", "3112000547") => "+57 311 200 05 47"
 */
function formatMobile(intlCode: string, mobile: string): string {
  const clean = mobile.replace(/\s/g, "");
  const code = intlCode.replace(/\+/g, "").trim();

  // Para Colombia (57) y números de 10 dígitos: +57 ### ### ## ##
  if (code === "57" && clean.length === 10) {
    return `+${code} ${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 8)} ${clean.slice(8)}`;
  }

  // Para otros países, formato general: +código número (con espacio cada 3-4 dígitos)
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 3) {
    parts.push(clean.slice(i, i + 3));
  }

  return `+${code} ${parts.join(" ")}`;
}

/**
 * Formatea un número de teléfono fijo con código de área
 * @example formatLandline("604", "1234567", "123") => "+57 (604) 123 4567 ext. 123"
 */
function formatLandline(
  intlCode: string,
  localCode: string | null,
  landline: string,
  extension: string | null,
): string {
  const clean = landline.replace(/\s/g, "");
  const intl = intlCode.replace(/\+/g, "").trim();

  let formatted = "";

  // Para Colombia con código de área
  if (intl === "57" && localCode) {
    const local = localCode.trim();
    // Formato: +57 (código) ### ####
    if (clean.length === 7) {
      formatted = `+${intl} (${local}) ${clean.slice(0, 3)} ${clean.slice(3)}`;
    } else {
      formatted = `+${intl} (${local}) ${clean}`;
    }
  } else if (localCode) {
    // Otros países con código local
    formatted = `+${intl} (${localCode.trim()}) ${clean}`;
  } else {
    // Sin código de área
    formatted = `+${intl} ${clean}`;
  }

  if (extension) {
    formatted += ` ext. ${extension}`;
  }

  return formatted;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "clients:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CLIENTE");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePagination(searchParams);
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(clients);

    // Obtener todos los clientes
    const allClients = await db
      .select()
      .from(clients)
      .orderBy(desc(clients.createdAt));

    // Para cada cliente, obtener su estado jurídico más reciente
    const itemsWithStatus = await Promise.all(
      allClients.slice(offset, offset + pageSize).map(async (client) => {
        const latestStatus = await db.query.clientLegalStatusHistory.findFirst({
          where: eq(clientLegalStatusHistory.clientId, client.id),
          orderBy: desc(clientLegalStatusHistory.createdAt),
          columns: { status: true },
        });

        const isActiveByLegalStatus =
          latestStatus?.status === "VIGENTE"
            ? true
            : latestStatus?.status
              ? false
              : client.isActive;

        return {
          ...client,
          isActive: isActiveByLegalStatus,
          legalStatus: latestStatus?.status || null,
        };
      })
    );

    const hasNextPage = offset + itemsWithStatus.length < total;

    return Response.json({ items: itemsWithStatus, page, pageSize, total, hasNextPage });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar clientes", { status: 500 });
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "clients:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_CLIENTE");

  if (forbidden) return forbidden;

  const payload = await request.json();

  // TIPO DE CLIENTE (para generar código)
  const clientType = String(payload.clientType ?? "NACIONAL").trim();
  const priceClientType = String(payload.priceClientType ?? "VIOMAR").trim();
  
  // Documentos requeridos según identificationType
  const identityDocumentUrl = payload.identityDocumentUrl 
    ? String(payload.identityDocumentUrl).trim() 
    : null;
  const rutDocumentUrl = payload.rutDocumentUrl 
    ? String(payload.rutDocumentUrl).trim() 
    : null;
  const commerceChamberDocumentUrl = payload.commerceChamberDocumentUrl 
    ? String(payload.commerceChamberDocumentUrl).trim() 
    : null;
  const passportDocumentUrl = payload.passportDocumentUrl 
    ? String(payload.passportDocumentUrl).trim() 
    : null;
  const taxCertificateDocumentUrl = payload.taxCertificateDocumentUrl 
    ? String(payload.taxCertificateDocumentUrl).trim() 
    : null;
  const companyIdDocumentUrl = payload.companyIdDocumentUrl 
    ? String(payload.companyIdDocumentUrl).trim() 
    : null;

  // Campos críticos requeridos
  const name = String(payload.name ?? "").trim();
  const identificationType = String(payload.identificationType ?? "").trim();
  const identification = String(payload.identification ?? "").trim();
  const taxRegime = String(payload.taxRegime ?? "").trim();
  const contactName = String(payload.contactName ?? "").trim();
  const email = String(payload.email ?? "").trim();
  const address = String(payload.address ?? "").trim();
  const mobile = String(payload.mobile ?? "").trim();

  if (
    !clientType ||
    !priceClientType ||
    !name ||
    !identificationType ||
    !identification ||
    !taxRegime ||
    !contactName ||
    !email ||
    !address ||
    !mobile
  ) {
    return new Response("Campos críticos requeridos faltantes", {
      status: 400,
    });
  }

  if (
    !["AUTORIZADO", "MAYORISTA", "VIOMAR", "COLANTA"].includes(
      priceClientType,
    )
  ) {
    return new Response("Tipo de cliente para precios COP inválido", {
      status: 400,
    });
  }

  if (identificationType === "CC" && !/^\d{6,10}$/.test(identification)) {
    return new Response("La CC debe tener entre 6 y 10 dígitos", {
      status: 400,
    });
  }

  if (identificationType === "NIT" && !/^\d{8,12}$/.test(identification)) {
    return new Response("El NIT debe tener entre 8 y 12 dígitos", {
      status: 400,
    });
  }

  if (
    identificationType === "CE" &&
    !/^[A-Za-z0-9]{5,15}$/.test(identification)
  ) {
    return new Response(
      "La CE debe tener entre 5 y 15 caracteres alfanuméricos",
      {
        status: 400,
      },
    );
  }

  if (
    identificationType === "PAS" &&
    !/^[A-Za-z0-9]{5,20}$/.test(identification)
  ) {
    return new Response(
      "El pasaporte debe tener entre 5 y 20 caracteres alfanuméricos",
      {
        status: 400,
      },
    );
  }

  if (identificationType === "EMPRESA_EXTERIOR" && identification.length < 3) {
    return new Response(
      "La identificación de empresa exterior debe tener al menos 3 caracteres",
      {
        status: 400,
      },
    );
  }

  const mobileDigits = mobile.replace(/\D/g, "");
  if (mobileDigits.length < 7 || mobileDigits.length > 15) {
    return new Response("El móvil debe tener entre 7 y 15 dígitos", {
      status: 400,
    });
  }

  // Validación de documentos basada en identificationType
  const docsValidation = validateRequiredDocuments(
    identificationType as any,
    {
      identityDocumentUrl,
      rutDocumentUrl,
      commerceChamberDocumentUrl,
      passportDocumentUrl,
      taxCertificateDocumentUrl,
      companyIdDocumentUrl,
    }
  );

  if (!docsValidation.isValid) {
    return new Response(
      `Documentos faltantes para ${identificationType}: ${docsValidation.missingDocuments.join(", ")}`,
      { status: 400 }
    );
  }

  const hasCredit = Boolean(payload.hasCredit);
  const promissoryNoteNumber = String(payload.promissoryNoteNumber ?? "").trim();
  const promissoryNoteDate = String(payload.promissoryNoteDate ?? "").trim();

  if (hasCredit && (!promissoryNoteNumber || !promissoryNoteDate)) {
    return new Response(
      "Cuando hay crédito, número y fecha de pagaré son obligatorios",
      {
        status: 400,
      },
    );
  }

  try {
    const sameClient = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.identification, identification))
      .limit(1);

    if (sameClient.length > 0) {
      return new Response(
        "La identificación ya existe en clientes. No se puede crear duplicado.",
        { status: 409 },
      );
    }

    const sameEmployee = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.identification, identification))
      .limit(1);

    if (sameEmployee.length > 0) {
      return new Response(
        "La identificación ya existe en empleados. Importa los datos desde ese módulo para continuar.",
        { status: 409 },
      );
    }

    // GENERAR CÓDIGO DE CLIENTE AUTOMÁTICO
    const prefix =
      clientType === "NACIONAL"
        ? "CN"
        : clientType === "EXTRANJERO"
          ? "CE"
          : "EM";

    // Obtener el último número de cliente para este tipo
    const lastClient = await db
      .select({ code: clients.clientCode })
      .from(clients)
      .where(sql`${clients.clientCode} LIKE ${prefix + "%"}`)
      .orderBy(desc(clients.clientCode))
      .limit(1);

    let nextNumber = 10001;

    if (lastClient.length > 0 && lastClient[0]?.code) {
      const lastNumber = parseInt(lastClient[0].code.slice(2), 10);

      if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
    }

    const clientCode = `${prefix}${nextNumber}`;

    // Calcular teléfonos completos
    const intlDialCode = String(payload.intlDialCode ?? "57").trim();
    const fullMobile = mobile ? formatMobile(intlDialCode, mobile) : null;

    const localDialCode = payload.localDialCode
      ? String(payload.localDialCode).trim()
      : null;
    const landline = payload.landline ? String(payload.landline).trim() : null;
    const extension = payload.extension
      ? String(payload.extension).trim()
      : null;

    let fullLandline = null;

    if (landline) {
      fullLandline = formatLandline(
        intlDialCode,
        localDialCode,
        landline,
        extension,
      );
    }

    const [newClient] = await db
      .insert(clients)
      .values({
        // CÓDIGO Y TIPO
        clientCode,
        clientType: clientType as "NACIONAL" | "EXTRANJERO" | "EMPLEADO",
        // DOCUMENTOS (determinados por identificationType)
        identityDocumentUrl,
        rutDocumentUrl,
        commerceChamberDocumentUrl,
        passportDocumentUrl,
        taxCertificateDocumentUrl,
        companyIdDocumentUrl,
        // IDENTIFICACIÓN
        name,
        identificationType: identificationType as
          | "CC"
          | "NIT"
          | "CE"
          | "PAS"
          | "EMPRESA_EXTERIOR",
        identification,
        dv: payload.dv ? String(payload.dv).trim() : null,
        branch: payload.branch ? String(payload.branch).trim() : "01",
        // FISCAL Y CONTACTO
        taxRegime: taxRegime as
          | "REGIMEN_COMUN"
          | "REGIMEN_SIMPLIFICADO"
          | "NO_RESPONSABLE",
        contactName,
        email,
        // UBICACIÓN
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
        // TELÉFONOS
        intlDialCode,
        mobile,
        fullMobile,
        localDialCode,
        landline,
        extension,
        fullLandline,
        // CRÉDITO Y ESTADO
        priceClientType: priceClientType as
          | "AUTORIZADO"
          | "MAYORISTA"
          | "VIOMAR"
          | "COLANTA",
        status: "INACTIVO",
        hasCredit: payload.hasCredit ?? false,
        promissoryNoteNumber: payload.promissoryNoteNumber
          ? String(payload.promissoryNoteNumber).trim()
          : null,
        promissoryNoteDate: payload.promissoryNoteDate || null,
        // Clientes nuevos inician inactivos hasta revisión jurídica
        isActive: false,
      })
      .returning();

    // Crear estado jurídico inicial "EN_REVISION" para clientes nuevos
    await db.insert(clientLegalStatusHistory).values({
      clientId: newClient.id,
      clientName: newClient.name,
      status: "EN_REVISION",
      notes: "Cliente nuevo - requiere revisión jurídica inicial",
      createdAt: new Date(),
    });

    console.log(`📋 Cliente ${newClient.clientCode} creado en estado EN_REVISION`);

    return Response.json(newClient, { status: 201 });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e && "code" in e
        ? (e as { code?: string }).code
        : undefined;

    if (code === "23505") {
      return new Response("La identificación ya existe", { status: 409 });
    }

    console.error("Error creating client:", e);

    return new Response("No se pudo crear el cliente", { status: 500 });
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "clients:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_CLIENTE");

  if (forbidden) return forbidden;

  const payload = await request.json();
  const { id } = payload;

  if (!id) {
    return new Response("Client ID required", { status: 400 });
  }

  // Obtener cliente actual para detectar cambios
  let currentClient;
  try {
    currentClient = await db.query.clients.findFirst({
      where: eq(clients.id, String(id)),
    });

    if (!currentClient) {
      return new Response("Cliente no encontrado", { status: 404 });
    }
  } catch (error) {
    console.error("Error obteniendo cliente actual:", error);
    return new Response("Error al obtener datos del cliente", { status: 500 });
  }

  if (
    payload.priceClientType !== undefined &&
    !["AUTORIZADO", "MAYORISTA", "VIOMAR", "COLANTA"].includes(
      String(payload.priceClientType).trim(),
    )
  ) {
    return new Response("Tipo de cliente para precios COP inválido", {
      status: 400,
    });
  }

  const patch: Partial<typeof clients.$inferInsert> = {};

  // IDENTIFICACIÓN
  if (payload.name !== undefined)
    patch.name = String(payload.name).trim();
  if (payload.priceClientType !== undefined)
    patch.priceClientType = String(payload.priceClientType).trim() as
      | "AUTORIZADO"
      | "MAYORISTA"
      | "VIOMAR"
      | "COLANTA";
  if (payload.identificationType !== undefined)
    patch.identificationType = String(payload.identificationType).trim() as
      | "CC"
      | "NIT"
      | "CE"
      | "PAS"
      | "EMPRESA_EXTERIOR";
  if (payload.identification !== undefined)
    patch.identification = String(payload.identification).trim();
  if (payload.dv !== undefined)
    patch.dv = payload.dv ? String(payload.dv).trim() : null;
  if (payload.branch !== undefined)
    patch.branch = payload.branch ? String(payload.branch).trim() : null;
  
  // DOCUMENTOS (determinados por identificationType)
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

  // FISCAL Y CONTACTO
  if (payload.taxRegime !== undefined)
    patch.taxRegime = String(payload.taxRegime).trim() as
      | "REGIMEN_COMUN"
      | "REGIMEN_SIMPLIFICADO"
      | "NO_RESPONSABLE";
  if (payload.contactName !== undefined)
    patch.contactName = String(payload.contactName).trim();
  if (payload.email !== undefined) patch.email = String(payload.email).trim();

  // UBICACIÓN
  if (payload.address !== undefined)
    patch.address = String(payload.address).trim();
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

  // TELÉFONOS - Calcular campos completos si se actualizan los componentes
  if (payload.intlDialCode !== undefined)
    patch.intlDialCode = payload.intlDialCode
      ? String(payload.intlDialCode).trim()
      : null;
  if (payload.mobile !== undefined)
    patch.mobile = payload.mobile ? String(payload.mobile).trim() : null;

  // Recalcular fullMobile si cambian intlDialCode o mobile
  if (payload.mobile !== undefined || payload.intlDialCode !== undefined) {
    const intl = payload.intlDialCode
      ? String(payload.intlDialCode).trim()
      : "57";
    const mob = payload.mobile ? String(payload.mobile).trim() : null;

    patch.fullMobile = mob ? formatMobile(intl, mob) : null;
  }

  if (payload.localDialCode !== undefined)
    patch.localDialCode = payload.localDialCode
      ? String(payload.localDialCode).trim()
      : null;
  if (payload.landline !== undefined)
    patch.landline = payload.landline ? String(payload.landline).trim() : null;
  if (payload.extension !== undefined)
    patch.extension = payload.extension
      ? String(payload.extension).trim()
      : null;

  // Recalcular fullLandline si cambian componentes
  if (
    payload.localDialCode !== undefined ||
    payload.landline !== undefined ||
    payload.extension !== undefined
  ) {
    const intl = payload.intlDialCode
      ? String(payload.intlDialCode).trim()
      : "57";
    const local = payload.localDialCode
      ? String(payload.localDialCode).trim()
      : null;
    const land = payload.landline ? String(payload.landline).trim() : null;
    const ext = payload.extension ? String(payload.extension).trim() : null;

    if (land) {
      patch.fullLandline = formatLandline(intl, local, land, ext);
    } else {
      patch.fullLandline = null;
    }
  }

  // CRÉDITO Y ESTADO
  if (payload.status !== undefined)
    patch.status = payload.status as "ACTIVO" | "INACTIVO" | "SUSPENDIDO";
  if (payload.hasCredit !== undefined) patch.hasCredit = payload.hasCredit;
  if (payload.promissoryNoteNumber !== undefined)
    patch.promissoryNoteNumber = payload.promissoryNoteNumber
      ? String(payload.promissoryNoteNumber).trim()
      : null;
  if (payload.promissoryNoteDate !== undefined)
    patch.promissoryNoteDate = payload.promissoryNoteDate || null;

  if (payload.isActive !== undefined) patch.isActive = payload.isActive;

  try {
    // Verificar isActive contra estado jurídico del cliente
    // Si no tiene estado jurídico o está bloqueado/en revisión, debe estar inactivo
    if (payload.isActive !== undefined || !patch.isActive) {
      const finalIsActive = await syncClientLegalStatusWithIsActive(
        String(id),
        payload.isActive
      );
      patch.isActive = finalIsActive;
    }

    if (patch.identification) {
      const duplicatedClient = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.identification, patch.identification))
        .limit(1);

      if (duplicatedClient[0] && duplicatedClient[0].id !== String(id)) {
        return new Response(
          "La identificación ya existe en clientes. No se puede duplicar.",
          { status: 409 },
        );
      }

      const duplicatedEmployee = await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.identification, patch.identification))
        .limit(1);

      if (duplicatedEmployee.length > 0) {
        return new Response(
          "La identificación ya existe en empleados. Importa los datos desde ese módulo para continuar.",
          { status: 409 },
        );
      }
    }

    const updated = await db
      .update(clients)
      .set(patch)
      .where(eq(clients.id, String(id)))
      .returning();

    // Detectar cambios en campos críticos y registrar automáticamente revisión
    if (updated.length > 0) {
      const changedFields = detectCriticalFieldChanges(currentClient, patch);

      if (changedFields.length > 0) {
        try {
          // Registrar automáticamente EN_REVISION y establecer isActive = false, status = INACTIVO
          await registerAutoRevisionOnClientChange(
            String(id),
            updated[0].name,
            changedFields
          );

          // Actualizar isActive a false y status a INACTIVO por el cambio automático
          await db
            .update(clients)
            .set({ isActive: false, status: "INACTIVO" })
            .where(eq(clients.id, String(id)));

          console.log(
            `⚠️ Cliente ${id} enviado a revisión automáticamente. Campos modificados: ${changedFields.join(", ")}`
          );
        } catch (revisionError) {
          console.error(
            "Advertencia: No se pudo registrar revisión automática:",
            revisionError
          );
          // No lanzar error, solo registrar la advertencia
        }
      }
    }

    return Response.json(updated);
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e && "code" in e
        ? (e as { code?: string }).code
        : undefined;

    if (code === "23505") {
      return new Response("La identificación ya existe", { status: 409 });
    }

    console.error("Error updating client:", e);

    return new Response("No se pudo actualizar el cliente", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "clients:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_CLIENTE");

  if (forbidden) return forbidden;

  const { id } = await request.json();

  if (!id) {
    return new Response("Client ID required", { status: 400 });
  }

  const deleted = await db
    .delete(clients)
    .where(eq(clients.id, String(id)))
    .returning();

  return Response.json(deleted);
}
