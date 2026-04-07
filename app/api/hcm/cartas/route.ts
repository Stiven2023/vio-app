import { randomUUID } from "node:crypto";

import { db } from "@/src/db";
import { cartasLaborales } from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { resolveEmployeeIdFromRequest } from "@/src/utils/employee-session";
import { hcmCartaLaboralCreateSchema } from "@/src/utils/hcm-contract";
import { rateLimit } from "@/src/utils/rate-limit";

function buildCartaCode() {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const suffix = randomUUID().slice(0, 8).toUpperCase();

  return `CL-${year}${month}-${suffix}`;
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "hcm:cartas:post",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const employeeId = await resolveEmployeeIdFromRequest(request);

  if (!employeeId) {
    return jsonError(
      401,
      "UNAUTHORIZED",
      "No autenticado o sin perfil de empleado.",
    );
  }

  const body = (await request.json().catch(() => null)) as unknown;

  if (body === null) {
    return jsonError(400, "INVALID_JSON", "El cuerpo JSON es inválido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = hcmCartaLaboralCreateSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "La solicitud de carta es inválida.",
    );
  }

  try {
    const [created] = await db
      .insert(cartasLaborales)
      .values({
        cartaCode: buildCartaCode(),
        employeeId,
        tipo: parsed.data.tipo,
        destinatario: parsed.data.destinatario || null,
        proposito: parsed.data.proposito || null,
        status: "EN_COLA",
      })
      .returning({
        id: cartasLaborales.id,
        cartaCode: cartasLaborales.cartaCode,
        status: cartasLaborales.status,
      });

    return Response.json(created, { status: 201 });
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudo crear la solicitud de carta laboral.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo crear la solicitud de carta laboral.",
    );
  }
}
