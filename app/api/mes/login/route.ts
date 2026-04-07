import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { erpDb } from "@/src/db";
import { employees, roles } from "@/src/db/erp/schema";
import {
  dbJsonError,
  jsonError,
  zodFirstErrorEnvelope,
} from "@/src/utils/api-error";
import { signMesAccessToken } from "@/src/utils/auth";
import { rateLimit } from "@/src/utils/rate-limit";

const SESSION_MAX_AGE = 60 * 60 * 12;

const bodySchema = z.object({
  email: z.string().trim().email(),
});

function resolveProcessContext(roleName: string) {
  switch (roleName) {
    case "OPERARIO_MONTAJE":
      return {
        processKey: "montaje",
        mesProcess: "montaje",
        operationType: "MONTAJE",
      };
    case "OPERARIO_FLOTER":
      return {
        processKey: "plotter",
        mesProcess: "plotter",
        operationType: "PLOTTER",
      };
    case "OPERARIO_SUBLIMACION":
      return {
        processKey: "sublimacion",
        mesProcess: "sublimacion",
        operationType: "SUBLIMACION",
      };
    case "OPERARIO_CORTE_LASER":
      return {
        processKey: "corte_laser",
        mesProcess: "corte",
        operationType: "CORTE_LASER",
      };
    case "OPERARIO_CORTE_MANUAL":
      return {
        processKey: "corte_manual",
        mesProcess: "corte",
        operationType: "CORTE_MANUAL",
      };
    case "OPERARIO_INTEGRACION_CALIDAD":
      return {
        processKey: "integracion",
        mesProcess: "integracion",
        operationType: "INTEGRACION",
      };
    case "OPERARIO_DESPACHO":
      return {
        processKey: "despacho",
        mesProcess: "despacho",
        operationType: "DESPACHO",
      };
    case "CONFECCIONISTA":
      return {
        processKey: "confeccion",
        mesProcess: "confeccion",
        operationType: "CONFECCION",
      };
    case "EMPAQUE":
      return {
        processKey: "empaque",
        mesProcess: "empaque",
        operationType: "EMPAQUE",
      };
    default:
      return null;
  }
}

function resolveProcessLabel(processKey: string) {
  switch (processKey) {
    case "montaje":
      return "Montaje";
    case "plotter":
      return "Plotter";
    case "sublimacion":
      return "Sublimación";
    case "corte_laser":
      return "Corte láser";
    case "corte_manual":
      return "Corte manual";
    case "integracion":
      return "Integración";
    case "despacho":
      return "Despacho";
    case "confeccion":
      return "Confección";
    case "empaque":
      return "Empaque";
    default:
      return processKey;
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:login:post",
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Los datos del ingreso operativo MES son inválidos.",
    );
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  try {
    const roleRows = await erpDb.select({ id: roles.id, name: roles.name }).from(roles);
    const mesRoles = roleRows.filter(
      (roleRow) =>
        roleRow.name === "OPERARIO" ||
        roleRow.name.startsWith("OPERARIO_") ||
        roleRow.name === "CONFECCIONISTA" ||
        roleRow.name === "EMPAQUE",
    );
    const mesRoleIds = mesRoles.map((roleRow) => roleRow.id);
    const roleNameById = new Map(mesRoles.map((roleRow) => [roleRow.id, roleRow.name]));

    if (mesRoleIds.length === 0) {
      return jsonError(
        409,
        "MES_ACCESS_UNAVAILABLE",
        "No hay roles operativos habilitados para ingreso MES.",
      );
    }

    const [employee] = await erpDb
      .select({
        id: employees.id,
        userId: employees.userId,
        name: employees.name,
        email: employees.email,
        roleId: employees.roleId,
        isActive: employees.isActive,
      })
      .from(employees)
      .where(
        and(
          eq(employees.email, normalizedEmail),
          inArray(employees.roleId, mesRoleIds),
        ),
      )
      .limit(1);

    if (!employee || employee.isActive === false) {
      return jsonError(
        404,
        "MES_OPERATOR_NOT_FOUND",
        "No existe un operario activo de MES con ese correo.",
        { email: ["No existe un operario activo de MES con ese correo."] },
      );
    }

    const roleName = roleNameById.get(employee.roleId ?? "") ?? "OPERARIO";
    const processContext = resolveProcessContext(roleName);
    const signed = signMesAccessToken({
      email: normalizedEmail,
      role: roleName,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeEmail: employee.email,
      userId: employee.userId,
      processKey: processContext?.processKey ?? null,
      mesProcess: processContext?.mesProcess ?? null,
      operationType: processContext?.operationType ?? null,
      machineId: null,
      machineName: null,
      typ: "mes_access",
    });

    const response = Response.json({
      ok: true,
      requiresProcessSelection: !processContext,
      selection: processContext
        ? {
            email: normalizedEmail,
            processKey: processContext.processKey,
            processLabel: resolveProcessLabel(processContext.processKey),
            mesProcess: processContext.mesProcess,
            operationType: processContext.operationType,
            machineId: null,
            machineName: null,
            employeeId: employee.id,
            employeeName: employee.name,
            employeeRole: roleName,
            employeeEmail: employee.email,
          }
        : null,
    });
    const secure = process.env.NODE_ENV === "production";

    response.headers.set(
      "Set-Cookie",
      `mes_access_token=${signed}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE};${secure ? " Secure;" : ""}`,
    );

    return response;
  } catch (error) {
    const dbError = dbJsonError(error, "No se pudo iniciar el acceso operativo MES.");

    if (dbError) {
      return dbError;
    }

    return jsonError(
      500,
      "INTERNAL_ERROR",
      "No se pudo iniciar el acceso operativo MES.",
    );
  }
}