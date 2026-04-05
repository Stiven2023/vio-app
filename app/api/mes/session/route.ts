import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getMesAccessProcessOption } from "@/app/mes/_components/mes-config";
import { erpDb, iamDb } from "@/src/db";
import { employees } from "@/src/db/erp/schema";
import { roles } from "@/src/db/iam/schema";
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
  processKey: z.enum([
    "montaje",
    "plotter",
    "calandra",
    "sublimacion",
    "corte_laser",
    "corte_manual",
    "integracion",
    "despacho",
  ]),
  machineId: z.string().trim().max(120).nullable().optional(),
  employeeId: z.string().trim().uuid(),
});

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:session:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(
      parsed.error,
      "Los datos del acceso MES son inválidos.",
    );
  }

  const processOption = getMesAccessProcessOption(parsed.data.processKey);

  if (!processOption) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "El proceso seleccionado no es válido.",
    );
  }

  const normalizedMachineId =
    parsed.data.machineId && parsed.data.machineId.trim() !== ""
      ? parsed.data.machineId.trim()
      : null;

  if (processOption.requiresMachine && !normalizedMachineId) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "La máquina es obligatoria para el proceso seleccionado.",
    );
  }

  if (!processOption.requiresMachine && normalizedMachineId) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "El proceso seleccionado no admite máquina.",
    );
  }

  const machine =
    processOption.machines.find((item) => item.id === normalizedMachineId) ??
    null;

  if (processOption.requiresMachine && !machine) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "La máquina seleccionada no es válida para este proceso.",
    );
  }

  try {
    const roleRows = await iamDb
      .select({ id: roles.id, name: roles.name })
      .from(roles);
    const operarioRoles = roleRows.filter(
      (roleRow) =>
        roleRow.name === "OPERARIO" || roleRow.name.startsWith("OPERARIO_"),
    );
    const allowedRoleIds = operarioRoles.map((roleRow) => roleRow.id);
    const roleNameById = new Map(
      roleRows.map((roleRow) => [roleRow.id, roleRow.name]),
    );

    if (allowedRoleIds.length === 0) {
      return jsonError(
        409,
        "MES_ACCESS_UNAVAILABLE",
        "No hay roles operativos habilitados para MES.",
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
          eq(employees.id, parsed.data.employeeId),
          inArray(employees.roleId, allowedRoleIds),
        ),
      )
      .limit(1);

    if (!employee || employee.isActive === false) {
      return jsonError(
        404,
        "EMPLOYEE_NOT_FOUND",
        "El empleado operativo seleccionado no está disponible.",
      );
    }

    const signed = signMesAccessToken({
      email: parsed.data.email,
      role: roleNameById.get(employee.roleId ?? "") ?? "OPERARIO",
      employeeId: employee.id,
      employeeName: employee.name,
      employeeEmail: employee.email,
      userId: employee.userId,
      processKey: processOption.key,
      mesProcess: processOption.mesProcess,
      operationType: processOption.operationType,
      machineId: machine?.id ?? null,
      machineName: machine?.name ?? null,
      typ: "mes_access",
    });

    const response = Response.json({
      ok: true,
      selection: {
        email: parsed.data.email,
        processKey: processOption.key,
        processLabel: processOption.label,
        mesProcess: processOption.mesProcess,
        operationType: processOption.operationType,
        machineId: machine?.id ?? null,
        machineName: machine?.name ?? null,
        employeeId: employee.id,
        employeeName: employee.name,
        employeeRole: roleNameById.get(employee.roleId ?? "") ?? null,
        employeeEmail: employee.email,
      },
    });
    const secure = process.env.NODE_ENV === "production";

    response.headers.set(
      "Set-Cookie",
      `mes_access_token=${signed}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MAX_AGE};${secure ? " Secure;" : ""}`,
    );

    return response;
  } catch (error) {
    const dbError = dbJsonError(error, "No se pudo crear la sesión MES.");

    if (dbError) {
      return dbError;
    }

    return jsonError(500, "INTERNAL_ERROR", "No se pudo crear la sesión MES.");
  }
}
