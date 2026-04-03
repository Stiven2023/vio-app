import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { confectionistPaymentRequests } from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import {
  postConfectionistPaymentEntry,
} from "@/src/utils/accounting-entries";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type PayBody = {
  paymentDate?: unknown;
  paymentMethod?: unknown;
  bankId?: unknown;
  paymentReference?: unknown;
  notes?: unknown;
};

function str(value: unknown) {
  return String(value ?? "").trim();
}

function isValidDate(value: unknown): boolean {
  if (!value) return false;
  const s = String(value).trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "confectionists:payment-requests:pay",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "APROBAR_PAGO_CONFECCION");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const requestId = str(id);

    if (!requestId) return new Response("id required", { status: 400 });

    const body = (await request.json().catch(() => ({}))) as PayBody;
    const paymentDate = str(body.paymentDate);
    const paymentMethod = str(body.paymentMethod) || "TRANSFERENCIA";

    const errors: Record<string, string[]> = {};

    if (!isValidDate(paymentDate))
      errors.paymentDate = ["Fecha de pago inválida (YYYY-MM-DD)."];

    if (Object.keys(errors).length > 0) {
      return Response.json({ errors }, { status: 422 });
    }

    const employeeId = getEmployeeIdFromRequest(request);

    const result = await db.transaction(async (tx) => {
      const [req] = await tx
        .select({
          id: confectionistPaymentRequests.id,
          requestCode: confectionistPaymentRequests.requestCode,
          status: confectionistPaymentRequests.status,
          amount: confectionistPaymentRequests.amount,
          orderItemConfectionId: confectionistPaymentRequests.orderItemConfectionId,
        })
        .from(confectionistPaymentRequests)
        .where(eq(confectionistPaymentRequests.id, requestId))
        .limit(1);

      if (!req) return { kind: "not-found" as const };

      if (req.status !== "APROBADO") {
        return { kind: "invalid-status" as const, status: req.status };
      }

      // Post accounting entry
      const entry = await postConfectionistPaymentEntry(
        tx,
        {
          requestId: req.id,
          requestCode: req.requestCode,
          workerId: req.orderItemConfectionId,
          paymentDate,
          amount: req.amount,
          paymentMethod,
          laborType: "CONFECCION",
        },
        employeeId,
      );

      await tx
        .update(confectionistPaymentRequests)
        .set({
          status: "PAGADO",
          paidAt: new Date(),
          paymentReference: str(body.paymentReference) || null,
          bankId: str(body.bankId) || null,
          accountingEntryId: entry.id,
          updatedAt: new Date(),
        })
        .where(eq(confectionistPaymentRequests.id, requestId));

      return { kind: "ok" as const, entryNumber: entry.entryNumber };
    });

    if (result.kind === "not-found") {
      return new Response("Solicitud no encontrada", { status: 404 });
    }

    if (result.kind === "invalid-status") {
      return new Response(
        `La solicitud debe estar en estado APROBADO para pagar (estado actual: ${result.status})`,
        { status: 422 },
      );
    }

    return Response.json(result);
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo registrar el pago", { status: 500 });
  }
}
