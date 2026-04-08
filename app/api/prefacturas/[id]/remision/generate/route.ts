import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { preInvoices as prefacturas, quotations } from "@/src/db/erp/schema";
import {
  normalizeProtectedRouteError,
  prefacturaIdRequiredError,
  prefacturaNotFoundError,
} from "@/src/utils/prefactura-siigo-contract";
import { jsonError } from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

// ── POST /api/prefacturas/[id]/remision/generate ──────────────────────────────
// Marks a type-R prefactura as remision-generated (sets siigoStatus to
// NOT_APPLICABLE) and records the generation timestamp.

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "prefacturas:remision:generate",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = normalizeProtectedRouteError(
    await requirePermission(request, "EDITAR_PEDIDO"),
    "No tienes permisos para generar remisiones.",
  );

  if (forbidden) return forbidden;

  const prefacturaId = String(params.id ?? "").trim();

  if (!prefacturaId) {
    return prefacturaIdRequiredError();
  }

  const [row] = await db
    .select({
      id: prefacturas.id,
      prefacturaCode: prefacturas.prefacturaCode,
      siigoStatus: prefacturas.siigoStatus,
      documentType: sql<string | null>`(
        SELECT q.document_type
        FROM quotations q
        WHERE q.id = ${prefacturas.quotationId}
        LIMIT 1
      )`,
    })
    .from(prefacturas)
    .where(eq(prefacturas.id, prefacturaId))
    .limit(1);

  if (!row) {
    return prefacturaNotFoundError();
  }

  if (row.documentType !== "R") {
    return jsonError(
      422,
      "REMISION_NOT_APPLICABLE",
      "Solo se puede generar remision para documentos de tipo R.",
    );
  }

  const blockedStatuses = new Set(["SENT", "INVOICED", "ACCEPTED"]);

  if (row.siigoStatus && blockedStatuses.has(String(row.siigoStatus).toUpperCase())) {
    return jsonError(
      409,
      "SIIGO_ALREADY_PROCESSED",
      "Este documento ya fue enviado a SIIGO y no puede convertirse en remision.",
    );
  }

  await db
    .update(prefacturas)
    .set({
      siigoStatus: "NOT_APPLICABLE",
    })
    .where(eq(prefacturas.id, prefacturaId));

  return Response.json({
    ok: true,
    prefacturaCode: row.prefacturaCode,
    siigoStatus: "NOT_APPLICABLE",
    message: `Remision generada para ${row.prefacturaCode}.`,
  });
}
