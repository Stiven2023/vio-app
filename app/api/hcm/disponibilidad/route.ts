import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { resolveEmployeeIdFromRequest } from "@/src/utils/employee-session";
import { hcmDisponibilidadQuerySchema } from "@/src/utils/hcm-contract";
import { rateLimit } from "@/src/utils/rate-limit";
import { verificarDisponibilidad } from "@/src/hcm/services/hcm.service";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "hcm:disponibilidad:get",
    limit: 120,
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

  const { searchParams } = new URL(request.url);
  const parsedQuery = hcmDisponibilidadQuerySchema.safeParse({
    fecha: searchParams.get("fecha") ?? undefined,
  });

  if (!parsedQuery.success) {
    return zodFirstErrorEnvelope(
      parsedQuery.error,
      "Parámetros de disponibilidad inválidos.",
    );
  }

  const data = await verificarDisponibilidad(
    employeeId,
    parsedQuery.data.fecha,
  );

  return Response.json({
    employeeId,
    fecha: parsedQuery.data.fecha,
    ...data,
  });
}
