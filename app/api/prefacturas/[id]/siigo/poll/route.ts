import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { prefacturas } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { SiigoApiError, siigoJson } from "@/src/utils/siigo";

type SiigoStamp = {
  status?: unknown;
  cufe?: unknown;
  legalizing_errors?: unknown[];
  uuid?: unknown;
};

type SiigoInvoiceDetail = {
  id?: unknown;
  name?: unknown;
  date?: unknown;
  stamp?: SiigoStamp;
};

// Map SIIGO stamp status to vio-app siigoStatus
function mapStampStatus(stampStatus: string): string {
  const normalized = String(stampStatus ?? "").toLowerCase().trim();

  if (normalized === "stamped" || normalized === "accepted") return "ACCEPTED";
  if (normalized === "rejected") return "REJECTED";

  return "SENT";
}

// ── POST /api/prefacturas/[id]/siigo/poll ─────────────────────────────────────

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "prefacturas:siigo:poll",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const prefacturaId = String(params.id ?? "").trim();

  if (!prefacturaId) {
    return Response.json({ error: "ID de prefactura requerido." }, { status: 400 });
  }

  const [pf] = await db
    .select({
      id: prefacturas.id,
      prefacturaCode: prefacturas.prefacturaCode,
      siigoStatus: prefacturas.siigoStatus,
      siigoInvoiceId: prefacturas.siigoInvoiceId,
    })
    .from(prefacturas)
    .where(eq(prefacturas.id, prefacturaId))
    .limit(1);

  if (!pf) {
    return Response.json(
      { error: "Prefactura no encontrada." },
      { status: 404 },
    );
  }

  if (!pf.siigoInvoiceId) {
    return Response.json(
      {
        error:
          "Esta prefactura no tiene un ID de factura SIIGO. Envíala primero a SIIGO.",
        siigoStatus: pf.siigoStatus,
      },
      { status: 422 },
    );
  }

  if (pf.siigoStatus === "ACCEPTED" || pf.siigoStatus === "REJECTED") {
    return Response.json({
      ok: true,
      alreadyFinal: true,
      siigoStatus: pf.siigoStatus,
      siigoInvoiceId: pf.siigoInvoiceId,
    });
  }

  try {
    const result = await siigoJson<SiigoInvoiceDetail>(
      `/v1/invoices/${encodeURIComponent(pf.siigoInvoiceId)}`,
    );

    const stamp = result.stamp ?? {};
    const stampStatus = String(stamp.status ?? "").trim();
    const cufe = String(stamp.cufe ?? stamp.uuid ?? "").trim() || null;
    const invoiceNumber = String(result.name ?? "").trim() || null;
    let issuedAt: Date | null = null;

    if (result.date) {
      try {
        const parsed = new Date(String(result.date));

        if (!Number.isNaN(parsed.getTime())) {
          issuedAt = parsed;
        }
      } catch {
        issuedAt = null;
      }
    }

    const newStatus = stampStatus ? mapStampStatus(stampStatus) : "SENT";

    const legalizingErrors = Array.isArray(stamp.legalizing_errors)
      ? stamp.legalizing_errors
          .map((e: unknown) => {
            if (typeof e === "object" && e !== null) {
              return String(
                (e as Record<string, unknown>).Message ??
                  (e as Record<string, unknown>).message ??
                  JSON.stringify(e),
              );
            }

            return String(e);
          })
          .join("; ")
      : null;

    await db
      .update(prefacturas)
      .set({
        siigoStatus: newStatus,
        siigoInvoiceNumber: invoiceNumber,
        siigoIssuedAt: issuedAt,
        siigoLastSyncAt: new Date(),
        siigoErrorMessage:
          newStatus === "REJECTED" && legalizingErrors
            ? legalizingErrors
            : null,
      })
      .where(eq(prefacturas.id, prefacturaId));

    return Response.json({
      ok: true,
      siigoStatus: newStatus,
      stampStatus: stampStatus || null,
      siigoInvoiceId: pf.siigoInvoiceId,
      siigoInvoiceNumber: invoiceNumber,
      siigoCufe: cufe,
      siigoIssuedAt: issuedAt?.toISOString() ?? null,
      legalizingErrors: legalizingErrors || null,
    });
  } catch (err) {
    let message = "Error al consultar estado de factura en SIIGO.";

    if (err instanceof SiigoApiError) {
      const body = err.payload as Record<string, unknown>;

      message =
        String(body?.message ?? err.message) ||
        message;
    } else {
      message = String((err as Error)?.message ?? message);
    }

    await db
      .update(prefacturas)
      .set({
        siigoLastSyncAt: new Date(),
        siigoErrorMessage: message,
      })
      .where(eq(prefacturas.id, prefacturaId));

    return Response.json({ error: message }, { status: 502 });
  }
}
