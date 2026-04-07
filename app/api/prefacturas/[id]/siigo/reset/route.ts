import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { preInvoices as prefacturas } from "@/src/db/erp/schema";
import {
  normalizeProtectedRouteError,
  prefacturaIdRequiredError,
  prefacturaNotFoundError,
  prefacturaReasonRequiredError,
  siigoResetNotAllowedError,
} from "@/src/utils/prefactura-siigo-contract";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

// ── POST /api/prefacturas/[id]/siigo/reset ────────────────────────────────────
// Admin-only: resets SIIGO status back to READY so the prefactura can be resent.
// This is an administrative action that clears the SIIGO tracking fields.

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "prefacturas:siigo:reset",
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  // Only administrators can reset SIIGO status
  const forbidden = normalizeProtectedRouteError(
    await requirePermission(request, "CAMBIAR_ESTADO_PEDIDO"),
    "No tienes permisos para resetear estados SIIGO.",
  );

  if (forbidden) return forbidden;

  const prefacturaId = String(params.id ?? "").trim();

  if (!prefacturaId) {
    return prefacturaIdRequiredError();
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const reason = String(body?.reason ?? "").trim();

  if (!reason) {
    return prefacturaReasonRequiredError();
  }

  const [pf] = await db
    .select({
      id: prefacturas.id,
      prefacturaCode: prefacturas.prefacturaCode,
      siigoStatus: prefacturas.siigoStatus,
    })
    .from(prefacturas)
    .where(eq(prefacturas.id, prefacturaId))
    .limit(1);

  if (!pf) {
    return prefacturaNotFoundError();
  }

  if (pf.siigoStatus === "NOT_APPLICABLE") {
    return siigoResetNotAllowedError();
  }

  const previousStatus = pf.siigoStatus;

  await db
    .update(prefacturas)
    .set({
      siigoStatus: "READY",
      siigoInvoiceId: null,
      siigoInvoiceNumber: null,
      siigoIssuedAt: null,
      siigoSentAt: null,
      siigoLastSyncAt: new Date(),
      siigoErrorMessage: `Reset por admin. Motivo: ${reason}. Estado anterior: ${previousStatus ?? "sin estado"}`,
    })
    .where(eq(prefacturas.id, prefacturaId));

  return Response.json({
    ok: true,
    prefacturaCode: pf.prefacturaCode,
    previousStatus,
    siigoStatus: "READY",
    reason,
  });
}
