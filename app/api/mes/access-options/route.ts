import { inArray } from "drizzle-orm";
import { z } from "zod";

import { erpDb, iamDb } from "@/src/db";
import { employees } from "@/src/db/erp/schema";
import { roles } from "@/src/db/iam/schema";
import { dbJsonError, jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
});

const MES_ALLOWED_ROLES = new Set([
  "ADMINISTRADOR",
  "LIDER_OPERACIONAL",
  "OPERARIO",
  "OPERARIO_INTEGRACION_CALIDAD",
  "OPERARIO_DESPACHO",
  "EMPAQUE",
  "CONFECCIONISTA",
  "PROGRAMACION",
  "MENSAJERO",
]);

function canAccessMesSelector(role: string | null) {
  if (!role) {
    return true;
  }

  return MES_ALLOWED_ROLES.has(role) || role.startsWith("OPERARIO_");
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:access-options:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);

  if (!canAccessMesSelector(role)) {
    return jsonError(403, "FORBIDDEN", "No tienes permisos para consultar accesos operativos de MES.");
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
  });

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Los filtros del acceso MES son inválidos.");
  }

  const search = String(parsed.data.q ?? "")
    .trim()
    .toLowerCase();

  try {
    const roleRows = await iamDb.select({ id: roles.id, name: roles.name }).from(roles);

    const operarioRoles = roleRows.filter(
      (roleRow) => roleRow.name === "OPERARIO" || roleRow.name.startsWith("OPERARIO_"),
    );
    const operarioRoleIds = operarioRoles.map((roleRow) => roleRow.id);
    const roleNameById = new Map(operarioRoles.map((roleRow) => [roleRow.id, roleRow.name]));

    if (operarioRoleIds.length === 0) {
      return Response.json({ items: [] });
    }

    const employeeRows = await erpDb
      .select({
        id: employees.id,
        name: employees.name,
        email: employees.email,
        roleId: employees.roleId,
        identification: employees.identification,
        isActive: employees.isActive,
      })
      .from(employees)
      .where(inArray(employees.roleId, operarioRoleIds));

    const items = employeeRows
      .filter((employee) => employee.isActive !== false)
      .map((employee) => ({
        id: employee.id,
        name: employee.name,
        email: employee.email,
        identification: employee.identification,
        role: employee.roleId ? roleNameById.get(employee.roleId) ?? null : null,
      }))
      .filter((employee) => {
        if (!search) {
          return true;
        }

        return [employee.name, employee.email, employee.identification, employee.role]
          .some((value) => String(value ?? "").toLowerCase().includes(search));
      })
      .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));

    return Response.json({ items });
  } catch (error) {
    const dbError = dbJsonError(error, "No se pudieron consultar los operarios de MES.");

    if (dbError) {
      return dbError;
    }

    return jsonError(500, "INTERNAL_ERROR", "No se pudieron consultar los operarios de MES.");
  }
}