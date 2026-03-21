import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { mesProductionQueue } from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { rateLimit } from "@/src/utils/rate-limit";

const PRIORITY_VALUES = ["URGENTE", "NORMAL", "BAJA"] as const;

function canWrite(role: string | null) {
  return role === "ADMINISTRADOR" || role === "LIDER_OPERACIONAL";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "mes:production-queue:patch",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);

  if (!role || !canWrite(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;
  const employeeId = getEmployeeIdFromRequest(request);

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const [existing] = await db
      .select()
      .from(mesProductionQueue)
      .where(eq(mesProductionQueue.id, id))
      .limit(1);

    if (!existing) {
      return new Response("No encontrado", { status: 404 });
    }

    type UpdateValues = {
      updatedAt: Date;
      priority?: (typeof PRIORITY_VALUES)[number];
      prioritySetBy?: string | null;
      prioritySetAt?: Date;
      finalOrder?: number;
      status?: "EN_COLA" | "EN_PROCESO" | "COMPLETADO";
    };

    const updates: UpdateValues = {
      updatedAt: new Date(),
    };

    if (body.priority !== undefined) {
      const priority = PRIORITY_VALUES.includes(
        body.priority as (typeof PRIORITY_VALUES)[number],
      )
        ? (body.priority as (typeof PRIORITY_VALUES)[number])
        : existing.priority;

      updates.priority = priority;
      updates.prioritySetBy = employeeId;
      updates.prioritySetAt = new Date();

      // If URGENTE, put at top by setting a low finalOrder
      if (priority === "URGENTE" && existing.priority !== "URGENTE") {
        updates.finalOrder = 1;
      }
    }

    if (body.finalOrder !== undefined) {
      const finalOrder = Math.max(1, Math.floor(Number(body.finalOrder ?? 1)));

      updates.finalOrder = finalOrder;
    }

    if (body.status !== undefined) {
      const allowed = ["EN_COLA", "EN_PROCESO", "COMPLETADO"] as const;

      if (allowed.includes(body.status as (typeof allowed)[number])) {
        updates.status = body.status as (typeof allowed)[number];
      }
    }

    const [updated] = await db
      .update(mesProductionQueue)
      .set(updates)
      .where(eq(mesProductionQueue.id, id))
      .returning();

    return Response.json(updated);
  } catch (error) {
    const resp = dbErrorResponse(error);

    if (resp) return resp;

    return new Response("Error al actualizar cola de producción", {
      status: 500,
    });
  }
}
