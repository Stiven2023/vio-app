import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { mesProductionQueue } from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { rateLimit } from "@/src/utils/rate-limit";

function canWrite(role: string | null) {
  return role === "ADMINISTRADOR" || role === "LIDER_OPERACIONAL";
}

/**
 * POST /api/mes/production-queue/confirm
 * The production leader confirms the queue, setting confirmedAt on all EN_COLA items.
 * This "activates" the queue so that the Montaje process can start picking tickets.
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "mes:production-queue:confirm",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const role = getRoleFromRequest(request);
  if (!role || !canWrite(role)) {
    return new Response("Forbidden", { status: 403 });
  }

  const employeeId = getEmployeeIdFromRequest(request);

  try {
    const now = new Date();

    const updated = await db
      .update(mesProductionQueue)
      .set({
        confirmedAt: now,
        confirmedBy: employeeId,
        updatedAt: now,
      })
      .where(
        and(
          eq(mesProductionQueue.status, "EN_COLA"),
        ),
      )
      .returning({ id: mesProductionQueue.id });

    return Response.json({
      confirmed: updated.length,
      confirmedAt: now.toISOString(),
    });
  } catch (error) {
    const resp = dbErrorResponse(error);
    if (resp) return resp;
    return new Response("Error al confirmar cola de producción", { status: 500 });
  }
}
