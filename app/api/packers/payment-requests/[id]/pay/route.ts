import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { packerPaymentRequests } from "@/src/db/erp/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { postPackerPaymentEntry } from "@/src/utils/accounting-entries";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type PayBody = {
  paymentDate?: unknown;
  paymentMethod?: unknown;
  bankId?: unknown;
  paymentReference?: unknown;
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
  const limited = rateLimit(request, { key: "packers:payment-requests:pay", limit: 60, windowMs: 60_000 });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "APROBAR_PAGO_EMPAQUE");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const requestId = str(id);

    if (!requestId) return new Response("id required", { status: 400 });

    const body = (await request.json().catch(() => ({}))) as PayBody;
    const paymentDate = str(body.paymentDate);
    const paymentMethod = str(body.paymentMethod) || "TRANSFERENCIA";

    if (!isValidDate(paymentDate)) {
      return Response.json({ errors: { paymentDate: ["Fecha de pago inválida (YYYY-MM-DD)."] } }, { status: 422 });
    }

    const employeeId = getEmployeeIdFromRequest(request);

    const result = await db.transaction(async (tx) => {
      const [req] = await tx
        .select({
          id: packerPaymentRequests.id,
          requestCode: packerPaymentRequests.requestCode,
          status: packerPaymentRequests.status,
          amount: packerPaymentRequests.amount,
          orderItemPackerId: packerPaymentRequests.orderItemPackerId,
        })
        .from(packerPaymentRequests)
        .where(eq(packerPaymentRequests.id, requestId))
        .limit(1);

      if (!req) return { kind: "not-found" as const };
      if (req.status !== "APROBADO") return { kind: "invalid-status" as const, status: req.status };

      const entry = await postPackerPaymentEntry(
        tx,
        {
          requestId: req.id,
          requestCode: req.requestCode,
          workerId: req.orderItemPackerId,
          paymentDate,
          amount: req.amount,
          paymentMethod,
          laborType: "EMPAQUE",
        },
        employeeId,
      );

      await tx
        .update(packerPaymentRequests)
        .set({
          status: "PAGADO",
          paidAt: new Date(),
          paymentReference: str(body.paymentReference) || null,
          bankId: str(body.bankId) || null,
          accountingEntryId: entry.id,
          updatedAt: new Date(),
        })
        .where(eq(packerPaymentRequests.id, requestId));

      return { kind: "ok" as const, entryNumber: entry.entryNumber };
    });

    if (result.kind === "not-found") return new Response("Solicitud no encontrada", { status: 404 });
    if (result.kind === "invalid-status") {
      return new Response(`La solicitud debe estar APROBADA para pagar (estado: ${result.status})`, { status: 422 });
    }

    return Response.json(result);
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo registrar el pago", { status: 500 });
  }
}
