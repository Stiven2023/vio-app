import { eq, sql, desc } from "drizzle-orm";

import { db } from "@/src/db";
import { clients, employees, clientLegalStatusHistory } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import {
  checkPermissions,
  requirePermission,
} from "@/src/utils/permission-middleware";
import { createNotificationsForPermission } from "@/src/utils/notifications";
import { parsePagination } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";
import {
  detectCriticalFieldChanges,
  registerAutoRevisionOnClientChange,
} from "@/app/erp/admin/_lib/sync-client-legal-status";

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

  try {
    const { searchParams } = new URL(request.url);
    const permissions = await checkPermissions(request, [
      "VER_CLIENTE",
      "VER_PEDIDO",
    ]);
    const canViewClients = Boolean(permissions.VER_CLIENTE);
    const canViewOrders = Boolean(permissions.VER_PEDIDO);

    if (!canViewClients && !canViewOrders) {
      return new Response("Access denied: missing permission", { status: 403 });
    }

    const { page, pageSize, offset } = parsePagination(searchParams);
    const q = String(searchParams.get("q") ?? "").trim();
    const forAutocomplete = ["1", "true", "yes"].includes(
      String(searchParams.get("forAutocomplete") ?? "")
        .trim()
        .toLowerCase(),
    );
    const onlyVigente = ["1", "true", "yes"].includes(
      String(searchParams.get("onlyVigente") ?? "")
        .trim()
        .toLowerCase(),
    );

    if (!canViewClients && !q) {
      return new Response("Search query is required", { status: 400 });
    }

    const qLike = `%${q}%`;
    const textFilter = q
      ? sql`(
          ${clients.name} ilike ${qLike}
          or ${clients.clientCode} ilike ${qLike}
          or ${clients.identification} ilike ${qLike}
          or ${clients.email} ilike ${qLike}
          or ${clients.contactName} ilike ${qLike}
        )`
      : undefined;
    const whereClause = forAutocomplete
      ? textFilter
        ? sql`${textFilter} and ${clients.isActive} = true`
        : sql`${clients.isActive} = true`
      : textFilter;

    const totalQuery = db
      .select({ total: sql<number>`count(*)::int` })
      .from(clients);

    const [{ total }] = whereClause
      ? await totalQuery.where(whereClause)
      : await totalQuery;

    const maxAutocompleteRows = Math.min(300, Math.max(pageSize * 5, 60));
    const itemsQuery = db
      .select()
      .from(clients)
      .orderBy(desc(clients.createdAt))
      .limit(forAutocomplete ? maxAutocompleteRows : pageSize)
      .offset(forAutocomplete ? 0 : offset);

    const pageClients = whereClause
      ? await itemsQuery.where(whereClause)
      : await itemsQuery;

    // Para cada cliente, obtener su estado jurídico más reciente
    const itemsWithStatus = await Promise.all(
      pageClients.map(async (client) => {
        const latestStatus = await db.query.clientLegalStatusHistory.findFirst({
          where: eq(clientLegalStatusHistory.clientId, client.id),
          orderBy: desc(clientLegalStatusHistory.createdAt),
          columns: { status: true },
        });

        return {
          ...client,
          isActive: client.isActive,
          legalStatus: latestStatus?.status || null,
        };
      }),
    );

    const filteredByLegalStatus = onlyVigente
      ? itemsWithStatus.filter((item) =>
          item.legalStatus
            ? item.legalStatus === "VIGENTE"
            : Boolean(item.isActive),
        )
      : itemsWithStatus;

    const pagedItems = forAutocomplete
      ? filteredByLegalStatus.slice(offset, offset + pageSize)
      : filteredByLegalStatus;
    const effectiveTotal = forAutocomplete
      ? filteredByLegalStatus.length
      : total;
    const hasNextPage = offset + pagedItems.length < effectiveTotal;

    return Response.json({
      items: pagedItems,
      page,
      pageSize,
      total: effectiveTotal,
      hasNextPage,
    });
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

  const hasCredit = Boolean(payload.hasCredit);
  const municipalityFiscal = payload.municipalityFiscal
    ? String(payload.municipalityFiscal).trim()
    : null;
  const taxZone = String(payload.taxZone ?? "CONTINENTAL")
    .trim()
    .toUpperCase();
  const paymentType = String(payload.paymentType ?? "CASH")
    .trim()
    .toUpperCase();
  const creditBackingType = payload.creditBackingType
    ? String(payload.creditBackingType).trim().toUpperCase()
    : null;
  const promissoryNoteNumber = String(
    payload.promissoryNoteNumber ?? "",
  ).trim();
  const promissoryNoteDate = String(payload.promissoryNoteDate ?? "").trim();
  const creditLimitRaw = payload.creditLimit;
  const creditLimitNumber =
    creditLimitRaw === null ||
    creditLimitRaw === undefined ||
    String(creditLimitRaw).trim() === ""
      ? null
      : Number(creditLimitRaw);

  if (
    creditLimitNumber !== null &&
    (!Number.isFinite(creditLimitNumber) || creditLimitNumber < 0)
  ) {
    return new Response("El monto tope de crédito es inválido", {
      status: 400,
    });
  }

  if (
    taxZone !== "CONTINENTAL" &&
    taxZone !== "FREE_ZONE" &&
    taxZone !== "SAN_ANDRES" &&
    taxZone !== "SPECIAL_REGIME"
  ) {
    return new Response("Tax zone inválida", {
      status: 400,
    });
  }

  if (paymentType !== "CASH" && paymentType !== "CREDIT") {
    return new Response("Payment type inválido", {
      status: 400,
    });
  }

  if (
    creditBackingType !== null &&
    creditBackingType !== "PROMISSORY_NOTE" &&
    creditBackingType !== "PURCHASE_ORDER" &&
    creditBackingType !== "VERBAL_AGREEMENT"
  ) {
    return new Response("Credit backing type inválido", {
      status: 400,
    });
  }

  if (
    paymentType === "CREDIT" &&
    hasCredit &&
    (creditLimitNumber === null || creditLimitNumber <= 0 || !creditBackingType)
  ) {
    return new Response(
      "Si paymentType es CREDIT y hasCredit es true, creditLimit debe ser mayor a 0 y creditBackingType es obligatorio",
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
        country: payload.country ? String(payload.country).trim() : "COLOMBIA",
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
        municipalityFiscal,
        taxZone: taxZone as
          | "CONTINENTAL"
          | "FREE_ZONE"
          | "SAN_ANDRES"
          | "SPECIAL_REGIME",
        paymentType: paymentType as "CASH" | "CREDIT",
        // CRÉDITO Y ESTADO
        status: "ACTIVO",
        hasCredit: payload.hasCredit ?? false,
        creditLimit:
          creditLimitNumber === null ? null : String(creditLimitNumber),
        creditBackingType: creditBackingType as
          | "PROMISSORY_NOTE"
          | "PURCHASE_ORDER"
          | "VERBAL_AGREEMENT"
          | null,
        promissoryNoteNumber: payload.promissoryNoteNumber
          ? String(payload.promissoryNoteNumber).trim()
          : null,
        promissoryNoteDate: payload.promissoryNoteDate || null,
        // Clientes nuevos inician activos pero en revisión jurídica
        isActive: true,
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

    console.log(
      `📋 Cliente ${newClient.clientCode} creado en estado EN_REVISION`,
    );

    void createNotificationsForPermission("VER_CLIENTE", {
      title: "Cliente creado",
      message: `Se registró el cliente ${newClient.clientCode} – ${newClient.name}.`,
      href: `/erp/clientes/${newClient.id}`,
    });
    void createNotificationsForPermission("VER_ESTADO_JURIDICO_CLIENTE", {
      title: "Cliente nuevo en revisión jurídica",
      message: `El cliente ${newClient.clientCode} requiere revisión jurídica inicial.`,
      href: `/erp/clientes/${newClient.id}`,
    });

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

  const patch: Partial<typeof clients.$inferInsert> = {};

  // IDENTIFICACIÓN
  if (payload.name !== undefined) patch.name = String(payload.name).trim();
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

  if (payload.municipalityFiscal !== undefined)
    patch.municipalityFiscal = payload.municipalityFiscal
      ? String(payload.municipalityFiscal).trim()
      : null;

  if (payload.taxZone !== undefined) {
    const normalizedTaxZone = String(payload.taxZone).trim().toUpperCase();

    if (
      normalizedTaxZone !== "CONTINENTAL" &&
      normalizedTaxZone !== "FREE_ZONE" &&
      normalizedTaxZone !== "SAN_ANDRES" &&
      normalizedTaxZone !== "SPECIAL_REGIME"
    ) {
      return new Response("Tax zone inválida", { status: 400 });
    }

    patch.taxZone = normalizedTaxZone as
      | "CONTINENTAL"
      | "FREE_ZONE"
      | "SAN_ANDRES"
      | "SPECIAL_REGIME";
  }

  if (payload.paymentType !== undefined) {
    const normalizedPaymentType = String(payload.paymentType)
      .trim()
      .toUpperCase();

    if (
      normalizedPaymentType !== "CASH" &&
      normalizedPaymentType !== "CREDIT"
    ) {
      return new Response("Payment type inválido", { status: 400 });
    }

    patch.paymentType = normalizedPaymentType as "CASH" | "CREDIT";
  }

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
  if (payload.creditLimit !== undefined) {
    if (
      payload.creditLimit === null ||
      String(payload.creditLimit).trim() === ""
    ) {
      patch.creditLimit = null;
    } else {
      const parsedCreditLimit = Number(payload.creditLimit);

      if (!Number.isFinite(parsedCreditLimit) || parsedCreditLimit < 0) {
        return new Response("El monto tope de crédito es inválido", {
          status: 400,
        });
      }
      patch.creditLimit = String(parsedCreditLimit);
    }
  }
  if (payload.promissoryNoteNumber !== undefined)
    patch.promissoryNoteNumber = payload.promissoryNoteNumber
      ? String(payload.promissoryNoteNumber).trim()
      : null;
  if (payload.creditBackingType !== undefined) {
    if (
      payload.creditBackingType === null ||
      String(payload.creditBackingType).trim() === ""
    ) {
      patch.creditBackingType = null;
    } else {
      const normalizedCreditBackingType = String(payload.creditBackingType)
        .trim()
        .toUpperCase();

      if (
        normalizedCreditBackingType !== "PROMISSORY_NOTE" &&
        normalizedCreditBackingType !== "PURCHASE_ORDER" &&
        normalizedCreditBackingType !== "VERBAL_AGREEMENT"
      ) {
        return new Response("Credit backing type inválido", { status: 400 });
      }

      patch.creditBackingType = normalizedCreditBackingType as
        | "PROMISSORY_NOTE"
        | "PURCHASE_ORDER"
        | "VERBAL_AGREEMENT";
    }
  }
  if (payload.promissoryNoteDate !== undefined)
    patch.promissoryNoteDate = payload.promissoryNoteDate || null;

  if (payload.isActive !== undefined) patch.isActive = payload.isActive;

  try {
    const effectiveHasCredit =
      patch.hasCredit !== undefined
        ? Boolean(patch.hasCredit)
        : Boolean(currentClient.hasCredit);
    const effectivePaymentType =
      patch.paymentType !== undefined
        ? patch.paymentType
        : currentClient.paymentType;
    const effectiveCreditLimit =
      patch.creditLimit !== undefined
        ? patch.creditLimit
        : currentClient.creditLimit;
    const effectiveCreditBackingType =
      patch.creditBackingType !== undefined
        ? patch.creditBackingType
        : currentClient.creditBackingType;

    const effectiveCreditLimitNumber =
      effectiveCreditLimit === null ||
      String(effectiveCreditLimit).trim() === ""
        ? null
        : Number(effectiveCreditLimit);

    if (
      effectivePaymentType === "CREDIT" &&
      effectiveHasCredit &&
      (!Number.isFinite(effectiveCreditLimitNumber) ||
        (effectiveCreditLimitNumber ?? 0) <= 0 ||
        !effectiveCreditBackingType)
    ) {
      return new Response(
        "Si paymentType es CREDIT y hasCredit es true, creditLimit debe ser mayor a 0 y creditBackingType es obligatorio",
        { status: 400 },
      );
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
          // Registrar automáticamente EN_REVISION
          await registerAutoRevisionOnClientChange(
            String(id),
            updated[0].name,
            changedFields,
          );

          console.log(
            `⚠️ Cliente ${id} enviado a revisión automáticamente. Campos modificados: ${changedFields.join(", ")}`,
          );

          void createNotificationsForPermission("VER_ESTADO_JURIDICO_CLIENTE", {
            title: "Cliente en revisión jurídica",
            message: `El cliente ${currentClient.clientCode} requiere revisión por cambios en: ${changedFields.join(", ")}.`,
            href: `/erp/clientes/${String(id)}`,
          });
        } catch (revisionError) {
          console.error(
            "Advertencia: No se pudo registrar revisión automática:",
            revisionError,
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
