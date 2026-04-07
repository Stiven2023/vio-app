import { and, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  certificados220,
  colillasPago,
  employees,
  inscripcionesFormacion,
  notificacionesHcm,
  solicitudesHorasExtras,
} from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  jsonForbidden,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { resolveEmployeeIdFromRequest } from "@/src/utils/employee-session";
import { hcmPortalParamsSchema } from "@/src/utils/hcm-contract";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const limited = rateLimit(request, {
    key: "hcm:portal:employee:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const sessionEmployeeId = await resolveEmployeeIdFromRequest(request);

  if (!sessionEmployeeId) {
    return jsonError(
      401,
      "UNAUTHORIZED",
      "No autenticado o sin perfil de empleado.",
    );
  }

  const parsedParams = hcmPortalParamsSchema.safeParse(await params);

  if (!parsedParams.success) {
    return zodFirstErrorEnvelope(
      parsedParams.error,
      "Parámetros de portal inválidos.",
    );
  }

  const { employeeId } = parsedParams.data;

  if (employeeId !== sessionEmployeeId) {
    const forbidden = await requirePermission(request, "VER_EMPLEADO");

    if (forbidden) return jsonForbidden();
  }

  try {
    const [employee] = await db
      .select({
        id: employees.id,
        name: employees.name,
        employeeCode: employees.employeeCode,
        email: employees.email,
        mobile: employees.mobile,
        contractType: employees.contractType,
        isActive: employees.isActive,
        employeeImageUrl: employees.employeeImageUrl,
      })
      .from(employees)
      .where(and(eq(employees.id, employeeId), eq(employees.isActive, true)))
      .limit(1);

    if (!employee) {
      return jsonError(404, "NOT_FOUND", "Empleado no encontrado.");
    }

    const [hoursExtraPending] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(solicitudesHorasExtras)
      .where(
        and(
          eq(solicitudesHorasExtras.employeeId, employeeId),
          eq(solicitudesHorasExtras.status, "PENDIENTE"),
        ),
      );

    const [unreadNotifications] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(notificacionesHcm)
      .where(
        and(
          eq(notificacionesHcm.employeeId, employeeId),
          eq(notificacionesHcm.leida, false),
        ),
      );

    const [payrollStubs] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(colillasPago)
      .where(eq(colillasPago.employeeId, employeeId));

    const [taxCertificates] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(certificados220)
      .where(eq(certificados220.employeeId, employeeId));

    const [trainings] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(inscripcionesFormacion)
      .where(eq(inscripcionesFormacion.employeeId, employeeId));

    return Response.json({
      employee,
      summary: {
        horasExtrasPendientes: hoursExtraPending?.total ?? 0,
        notificacionesSinLeer: unreadNotifications?.total ?? 0,
        colillas: payrollStubs?.total ?? 0,
        certificados220: taxCertificates?.total ?? 0,
        formaciones: trainings?.total ?? 0,
      },
    });
  } catch (error) {
    const response = dbJsonError(
      error,
      "No se pudo consultar el portal del empleado.",
    );

    if (response) return response;

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo consultar el portal del empleado.",
    );
  }
}
