import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";

import { db } from "@/src/db";
import { messengers } from "@/src/db/erp/schema";
import {
  createMessengerSchema,
  deleteMessengerSchema,
  updateMessengerSchema,
} from "@/src/utils/messengers-contract";
import {
  jsonError,
  jsonForbidden,
  zodFirstErrorEnvelope,
  dbJsonError,
} from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { parsePaginationStrict } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

async function generateMessengerCode(prefix: "MENS" | "COND") {
  const [last] = await db
    .select({ code: messengers.messengerCode })
    .from(messengers)
    .where(ilike(messengers.messengerCode, `${prefix}%`))
    .orderBy(desc(messengers.messengerCode))
    .limit(1);

  let next = 1001;

  if (last?.code) {
    const parsed = Number.parseInt(last.code.replace(/^\D+/g, ""), 10);

    if (Number.isFinite(parsed)) {
      next = parsed + 1;
    }
  }

  return `${prefix}${next}`;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "messengers:get",
    limit: 180,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return jsonForbidden();

  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, offset } = parsePaginationStrict(searchParams, {
      defaultPageSize: 20,
      maxPageSize: 100,
    });

    const q = String(searchParams.get("q") ?? "").trim();
    const type = String(searchParams.get("type") ?? "")
      .trim()
      .toUpperCase();
    const activeRaw = String(searchParams.get("active") ?? "")
      .trim()
      .toLowerCase();

    const whereClauses = [] as Array<any>;

    if (q) {
      whereClauses.push(
        or(
          ilike(messengers.messengerCode, `%${q}%`),
          ilike(messengers.name, `%${q}%`),
          ilike(messengers.identification, `%${q}%`),
          ilike(messengers.email, `%${q}%`),
          ilike(messengers.vehiclePlate, `%${q}%`),
        ),
      );
    }

    if (type === "MENSAJERO" || type === "CONDUCTOR") {
      whereClauses.push(eq(messengers.messengerType, type));
    }

    if (activeRaw === "true") {
      whereClauses.push(eq(messengers.isActive, true));
    }

    if (activeRaw === "false") {
      whereClauses.push(eq(messengers.isActive, false));
    }

    const where = whereClauses.length > 0 ? and(...whereClauses) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(messengers)
      .where(where);

    const items = await db
      .select({
        id: messengers.id,
        messengerCode: messengers.messengerCode,
        name: messengers.name,
        identificationType: messengers.identificationType,
        identification: messengers.identification,
        address: messengers.address,
        messengerType: messengers.messengerType,
        vehicleType: messengers.vehicleType,
        vehiclePlate: messengers.vehiclePlate,
        drivingLicenseUrl: messengers.drivingLicenseUrl,
        drivingLicenseExpiresAt: messengers.drivingLicenseExpiresAt,
        soatDocumentUrl: messengers.soatDocumentUrl,
        soatDocumentExpiresAt: messengers.soatDocumentExpiresAt,
        tecnomecanicaDocumentUrl: messengers.tecnomecanicaDocumentUrl,
        tecnomecanicaDocumentExpiresAt: messengers.tecnomecanicaDocumentExpiresAt,
        vehicleLicenseDocumentUrl: messengers.vehicleLicenseDocumentUrl,
        vehicleLicenseDocumentExpiresAt:
          messengers.vehicleLicenseDocumentExpiresAt,
        email: messengers.email,
        mobile: messengers.mobile,
        isActive: messengers.isActive,
        createdAt: messengers.createdAt,
      })
      .from(messengers)
      .where(where)
      .orderBy(asc(messengers.name))
      .limit(pageSize)
      .offset(offset);

    return Response.json({
      items,
      page,
      pageSize,
      total: Number(total ?? 0),
      hasNextPage: offset + items.length < Number(total ?? 0),
    });
  } catch (error) {
    const dbErr = dbJsonError(
      error,
      "No se pudieron consultar mensajeros/conductores.",
    );

    if (dbErr) return dbErr;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudieron consultar mensajeros/conductores.",
    );
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "messengers:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) return jsonForbidden();

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = createMessengerSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Los datos de mensajero/conductor son inválidos.",
    );
  }

  const payload = parsed.data;

  try {
    const prefix = payload.messengerType === "CONDUCTOR" ? "COND" : "MENS";
    const messengerCode = await generateMessengerCode(prefix);

    const [created] = await db
      .insert(messengers)
      .values({
        messengerCode,
        name: payload.name,
        identificationType: payload.identificationType,
        identification: payload.identification,
        address: payload.address,
        messengerType: payload.messengerType,
        vehicleType: payload.vehicleType ?? null,
        vehiclePlate: (payload.vehiclePlate ?? "").toUpperCase() || null,
        drivingLicenseUrl: payload.drivingLicenseUrl ?? null,
        drivingLicenseExpiresAt: payload.drivingLicenseExpiresAt ?? null,
        soatDocumentUrl: payload.soatDocumentUrl ?? null,
        soatDocumentExpiresAt: payload.soatDocumentExpiresAt ?? null,
        tecnomecanicaDocumentUrl: payload.tecnomecanicaDocumentUrl ?? null,
        tecnomecanicaDocumentExpiresAt:
          payload.tecnomecanicaDocumentExpiresAt ?? null,
        vehicleLicenseDocumentUrl: payload.vehicleLicenseDocumentUrl ?? null,
        vehicleLicenseDocumentExpiresAt:
          payload.vehicleLicenseDocumentExpiresAt ?? null,
        email: payload.email ?? null,
        mobile: payload.mobile ?? null,
        isActive: payload.isActive,
      })
      .returning({
        id: messengers.id,
        messengerCode: messengers.messengerCode,
      });

    return Response.json(created, { status: 201 });
  } catch (error) {
    const dbErr = dbJsonError(
      error,
      "No se pudo crear el mensajero/conductor.",
    );

    if (dbErr) return dbErr;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo crear el mensajero/conductor.",
    );
  }
}

export async function PUT(request: Request) {
  const limited = rateLimit(request, {
    key: "messengers:put",
    limit: 90,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) return jsonForbidden();

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = updateMessengerSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Los datos de actualización son inválidos.",
    );
  }

  const payload = parsed.data;

  try {
    const patch: Partial<typeof messengers.$inferInsert> = {};

    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.identificationType !== undefined)
      patch.identificationType = payload.identificationType;
    if (payload.identification !== undefined)
      patch.identification = payload.identification;
    if (payload.address !== undefined) patch.address = payload.address;
    if (payload.messengerType !== undefined)
      patch.messengerType = payload.messengerType;
    if (payload.vehicleType !== undefined)
      patch.vehicleType = payload.vehicleType ?? null;
    if (payload.vehiclePlate !== undefined)
      patch.vehiclePlate = (payload.vehiclePlate ?? "").toUpperCase() || null;
    if (payload.drivingLicenseUrl !== undefined)
      patch.drivingLicenseUrl = payload.drivingLicenseUrl ?? null;
    if (payload.drivingLicenseExpiresAt !== undefined)
      patch.drivingLicenseExpiresAt = payload.drivingLicenseExpiresAt ?? null;
    if (payload.soatDocumentUrl !== undefined)
      patch.soatDocumentUrl = payload.soatDocumentUrl ?? null;
    if (payload.soatDocumentExpiresAt !== undefined)
      patch.soatDocumentExpiresAt = payload.soatDocumentExpiresAt ?? null;
    if (payload.tecnomecanicaDocumentUrl !== undefined)
      patch.tecnomecanicaDocumentUrl = payload.tecnomecanicaDocumentUrl ?? null;
    if (payload.tecnomecanicaDocumentExpiresAt !== undefined)
      patch.tecnomecanicaDocumentExpiresAt =
        payload.tecnomecanicaDocumentExpiresAt ?? null;
    if (payload.vehicleLicenseDocumentUrl !== undefined)
      patch.vehicleLicenseDocumentUrl = payload.vehicleLicenseDocumentUrl ?? null;
    if (payload.vehicleLicenseDocumentExpiresAt !== undefined)
      patch.vehicleLicenseDocumentExpiresAt =
        payload.vehicleLicenseDocumentExpiresAt ?? null;
    if (payload.email !== undefined) patch.email = payload.email ?? null;
    if (payload.mobile !== undefined) patch.mobile = payload.mobile ?? null;
    if (payload.isActive !== undefined) patch.isActive = payload.isActive;

    if (Object.keys(patch).length === 0) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "No hay cambios para actualizar.",
        {
          body: ["Envía al menos un campo para actualizar."],
        },
      );
    }

    const [updated] = await db
      .update(messengers)
      .set(patch)
      .where(eq(messengers.id, payload.id))
      .returning({ id: messengers.id });

    if (!updated) {
      return jsonError(404, "NOT_FOUND", "El mensajero/conductor no existe.");
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    const dbErr = dbJsonError(
      error,
      "No se pudo actualizar el mensajero/conductor.",
    );

    if (dbErr) return dbErr;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo actualizar el mensajero/conductor.",
    );
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "messengers:delete",
    limit: 45,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ORDEN_COMPRA");

  if (forbidden) return jsonForbidden();

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = deleteMessengerSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "La solicitud para eliminar es inválida.",
    );
  }

  try {
    const [deleted] = await db
      .delete(messengers)
      .where(eq(messengers.id, parsed.data.id))
      .returning({ id: messengers.id });

    if (!deleted) {
      return jsonError(404, "NOT_FOUND", "El mensajero/conductor no existe.");
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    const dbErr = dbJsonError(
      error,
      "No se pudo eliminar el mensajero/conductor.",
    );

    if (dbErr) return dbErr;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo eliminar el mensajero/conductor.",
    );
  }
}
