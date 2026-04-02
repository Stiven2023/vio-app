import { eq } from "drizzle-orm";

import { erpDb } from "@/src/db";
import { clientLegalStatus, clients } from "@/src/db/erp/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { rateLimit } from "@/src/utils/rate-limit";

const READ_ROLES = new Set([
  "ADMINISTRADOR",
  "LIDER_JURIDICA",
  "LIDER_OPERACIONAL",
  "OPERARIO_DESPACHO",
  "PROGRAMACION",
]);

const WRITE_ROLES = new Set(["ADMINISTRADOR", "LIDER_JURIDICA"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const limited = rateLimit(request, {
    key: "mes:client-legal-status:clientId:get",
    limit: 300,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);

  if (!role || !READ_ROLES.has(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { clientId } = await params;

  try {
    const [row] = await erpDb
      .select({
        id: clientLegalStatus.id,
        clientId: clientLegalStatus.clientId,
        isLegallyEnabled: clientLegalStatus.isLegallyEnabled,
        legalNotes: clientLegalStatus.legalNotes,
        enabledAt: clientLegalStatus.enabledAt,
        disabledAt: clientLegalStatus.disabledAt,
        updatedAt: clientLegalStatus.updatedAt,
        clientName: clients.name,
      })
      .from(clientLegalStatus)
      .innerJoin(clients, eq(clientLegalStatus.clientId, clients.id))
      .where(eq(clientLegalStatus.clientId, clientId))
      .limit(1);

    if (!row) {
      // No record means enabled by default
      return Response.json({
        clientId,
        isLegallyEnabled: true,
        legalNotes: null,
      });
    }

    return Response.json(row);
  } catch (error) {
    const resp = dbErrorResponse(error);

    if (resp) return resp;

    return new Response("Error al consultar estado jurídico del cliente", {
      status: 500,
    });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  const limited = rateLimit(request, {
    key: "mes:client-legal-status:clientId:put",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);

  if (!role || !WRITE_ROLES.has(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { clientId } = await params;
  const employeeId = getEmployeeIdFromRequest(request);

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const isLegallyEnabled =
      typeof body.isLegallyEnabled === "boolean"
        ? body.isLegallyEnabled
        : String(body.isLegallyEnabled ?? "true").toLowerCase() !== "false";

    const legalNotes = body.legalNotes
      ? String(body.legalNotes).trim() || null
      : null;

    if (!isLegallyEnabled && !legalNotes) {
      return new Response(
        "Las notas jurídicas son obligatorias al deshabilitar un cliente",
        { status: 400 },
      );
    }

    // Verify the client exists
    const [clientRow] = await erpDb
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!clientRow) {
      return new Response("Cliente no encontrado", { status: 404 });
    }

    const now = new Date();

    const [existing] = await erpDb
      .select({ id: clientLegalStatus.id })
      .from(clientLegalStatus)
      .where(eq(clientLegalStatus.clientId, clientId))
      .limit(1);

    let result;

    if (existing) {
      [result] = await erpDb
        .update(clientLegalStatus)
        .set({
          isLegallyEnabled,
          legalNotes,
          enabledAt: isLegallyEnabled ? now : undefined,
          disabledAt: !isLegallyEnabled ? now : undefined,
          updatedBy: employeeId,
          updatedAt: now,
        })
        .where(eq(clientLegalStatus.clientId, clientId))
        .returning();
    } else {
      [result] = await erpDb
        .insert(clientLegalStatus)
        .values({
          clientId,
          isLegallyEnabled,
          legalNotes,
          enabledAt: isLegallyEnabled ? now : null,
          disabledAt: !isLegallyEnabled ? now : null,
          updatedBy: employeeId,
          updatedAt: now,
        })
        .returning();
    }

    return Response.json(result);
  } catch (error) {
    const resp = dbErrorResponse(error);

    if (resp) return resp;

    return new Response("Error al actualizar estado jurídico del cliente", {
      status: 500,
    });
  }
}
