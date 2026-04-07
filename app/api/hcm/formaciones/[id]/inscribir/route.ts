import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { formaciones, inscripcionesFormacion } from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { resolveEmployeeIdFromRequest } from "@/src/utils/employee-session";
import { hcmInscripcionFormacionParamsSchema } from "@/src/utils/hcm-contract";
import { rateLimit } from "@/src/utils/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "hcm:formaciones:inscribir:post",
    limit: 50,
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

  const parsedParams = hcmInscripcionFormacionParamsSchema.safeParse(
    await params,
  );

  if (!parsedParams.success) {
    return zodFirstErrorEnvelope(
      parsedParams.error,
      "Parámetros de formación inválidos.",
    );
  }

  const formacionId = parsedParams.data.id;

  try {
    const [formacion] = await db
      .select({ id: formaciones.id })
      .from(formaciones)
      .where(
        and(eq(formaciones.id, formacionId), eq(formaciones.isActive, true)),
      )
      .limit(1);

    if (!formacion) {
      return jsonError(404, "NOT_FOUND", "Formación no encontrada o inactiva.");
    }

    const created = await db
      .insert(inscripcionesFormacion)
      .values({
        employeeId,
        formacionId,
        status: "INSCRITO",
      })
      .onConflictDoNothing()
      .returning({
        id: inscripcionesFormacion.id,
        formacionId: inscripcionesFormacion.formacionId,
        status: inscripcionesFormacion.status,
      });

    if (!created[0]) {
      return jsonError(
        409,
        "HCM_FORMACION_ALREADY_ENROLLED",
        "El empleado ya se encuentra inscrito en esta formación.",
      );
    }

    return Response.json(created[0], { status: 201 });
  } catch (error) {
    const response = dbJsonError(error, "No se pudo inscribir la formación.");

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo inscribir la formación.",
    );
  }
}
