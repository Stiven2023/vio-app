import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { employeeLeaves, employees } from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseBooleanOrNull(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;

  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "employee-leaves:patch",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "APROBAR_PERMISO_EMPLEADO",
  );

  if (forbidden) return forbidden;

  const { id } = await params;

  try {
    const body = await request.json();

    const [existing] = await db
      .select({ id: employeeLeaves.id })
      .from(employeeLeaves)
      .where(eq(employeeLeaves.id, id))
      .limit(1);

    if (!existing) {
      return new Response("Permiso no encontrado", { status: 404 });
    }

    const patch: {
      employeeId?: string;
      leaveType?: "PAID" | "UNPAID";
      startDate?: string;
      endDate?: string;
      hoursAbsent?: string | null;
      payrollDeduction?: boolean;
      notes?: string | null;
      approvedBy?: string | null;
    } = {};

    if (body?.employeeId !== undefined) {
      const employeeId = String(body.employeeId ?? "").trim();

      if (!employeeId) {
        return new Response("Empleado inválido", { status: 400 });
      }

      const [employeeExists] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.id, employeeId), eq(employees.isActive, true)))
        .limit(1);

      if (!employeeExists) {
        return new Response("Empleado no encontrado o inactivo", {
          status: 404,
        });
      }

      patch.employeeId = employeeId;
    }

    if (body?.leaveType !== undefined) {
      const leaveType = String(body.leaveType ?? "")
        .trim()
        .toUpperCase() as "PAID" | "UNPAID";

      if (!(leaveType === "PAID" || leaveType === "UNPAID")) {
        return new Response("Tipo de permiso inválido", { status: 400 });
      }

      patch.leaveType = leaveType;
    }

    const startDate =
      body?.startDate !== undefined
        ? String(body.startDate ?? "").trim()
        : undefined;
    const endDate =
      body?.endDate !== undefined
        ? String(body.endDate ?? "").trim()
        : undefined;

    if (startDate !== undefined) {
      if (!isIsoDate(startDate)) {
        return new Response("Fecha inicial inválida", { status: 400 });
      }
      patch.startDate = startDate;
    }

    if (endDate !== undefined) {
      if (!isIsoDate(endDate)) {
        return new Response("Fecha final inválida", { status: 400 });
      }
      patch.endDate = endDate;
    }

    if (patch.startDate && patch.endDate && patch.startDate > patch.endDate) {
      return new Response("La fecha final no puede ser menor que la inicial", {
        status: 400,
      });
    }

    if (body?.hoursAbsent !== undefined) {
      const hours = toNumberOrNull(body.hoursAbsent);

      if (hours === null) {
        return new Response("Horas ausentes inválidas", { status: 400 });
      }

      patch.hoursAbsent = hours.toFixed(2);
    }

    if (body?.payrollDeduction !== undefined) {
      const payrollDeduction = parseBooleanOrNull(body.payrollDeduction);

      if (payrollDeduction === null) {
        return new Response("Descuento por nómina inválido", { status: 400 });
      }

      patch.payrollDeduction = payrollDeduction;
    }

    if (body?.notes !== undefined) {
      const notes = String(body.notes ?? "").trim();

      patch.notes = notes || null;
    }

    patch.approvedBy = getEmployeeIdFromRequest(request);

    if (Object.keys(patch).length === 0) {
      return new Response("Sin cambios para aplicar", { status: 400 });
    }

    await db.update(employeeLeaves).set(patch).where(eq(employeeLeaves.id, id));

    return Response.json({ ok: true });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo actualizar el permiso", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "employee-leaves:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "APROBAR_PERMISO_EMPLEADO",
  );

  if (forbidden) return forbidden;

  const { id } = await params;

  try {
    const [existing] = await db
      .select({ id: employeeLeaves.id })
      .from(employeeLeaves)
      .where(eq(employeeLeaves.id, id))
      .limit(1);

    if (!existing) {
      return new Response("Permiso no encontrado", { status: 404 });
    }

    await db.delete(employeeLeaves).where(eq(employeeLeaves.id, id));

    return Response.json({ ok: true });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo eliminar el permiso", { status: 500 });
  }
}
