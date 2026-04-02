import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { preInvoices as prefacturas } from "@/src/db/erp/schema";
import { getRoleFromRequest } from "@/src/utils/auth-middleware";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { SiigoApiError, siigoJson } from "@/src/utils/siigo";

const ACCOUNTING_ROLES = new Set([
  "ADMINISTRADOR",
  "LIDER_FINANCIERA",
  "AUXILIAR_CONTABLE",
  "TESORERIA_Y_CARTERA",
]);

type SiigoInvoiceStatus = {
  id?: unknown;
  number?: unknown;
  date?: unknown;
  stamp?: {
    status?: unknown;
    legalStatus?: unknown;
    errors?: unknown;
  };
  [key: string]: unknown;
};

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "prefacturas:siigo:poll",
    limit: 10,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const role = getRoleFromRequest(request);
  const isAccounting = Boolean(role && ACCOUNTING_ROLES.has(role));

  if (!isAccounting) {
    const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

    if (forbidden) return forbidden;
  }

  try {
    // Find all prefacturas with siigoStatus = SENT
    const sentPrefacturas = await db
      .select({
        id: prefacturas.id,
        prefacturaCode: prefacturas.prefacturaCode,
        siigoInvoiceId: prefacturas.siigoInvoiceId,
      })
      .from(prefacturas)
      .where(eq(prefacturas.siigoStatus, "SENT"));

    if (sentPrefacturas.length === 0) {
      return Response.json({
        ok: true,
        polled: 0,
        invoiced: 0,
        errors: 0,
        results: [],
      });
    }

    type PollResult = {
      id: string;
      prefacturaCode: string;
      outcome: "INVOICED" | "ERROR" | "PENDING";
      siigoInvoiceNumber: string | null;
      siigoIssuedAt: string | null;
      error: string | null;
    };

    const results: PollResult[] = [];
    let invoicedCount = 0;
    let errorCount = 0;

    for (const pf of sentPrefacturas) {
      const siigoId = String(pf.siigoInvoiceId ?? "").trim();

      if (!siigoId) {
        // No SIIGO id to query — mark as error
        await db
          .update(prefacturas)
          .set({
            siigoStatus: "ERROR",
            siigoErrorMessage: "No hay siigoInvoiceId registrado para consultar.",
            siigoLastSyncAt: new Date(),
          })
          .where(eq(prefacturas.id, pf.id));

        results.push({
          id: pf.id,
          prefacturaCode: pf.prefacturaCode,
          outcome: "ERROR",
          siigoInvoiceNumber: null,
          siigoIssuedAt: null,
          error: "No hay siigoInvoiceId registrado para consultar.",
        });
        errorCount++;
        continue;
      }

      try {
        const invoiceData = await siigoJson<SiigoInvoiceStatus>(
          `/invoices/${siigoId}`,
        );

        const invoiceNumber = String(invoiceData?.number ?? "").trim() || null;
        const invoiceDate = String(invoiceData?.date ?? "").trim() || null;
        const stampStatus = String(
          invoiceData?.stamp?.status ?? invoiceData?.stamp?.legalStatus ?? "",
        )
          .trim()
          .toUpperCase();

        // Consider INVOICED when SIIGO has a number (or when stamp status is success)
        const isInvoiced =
          Boolean(invoiceNumber) ||
          stampStatus === "OK" ||
          stampStatus === "STAMPED" ||
          stampStatus === "PROCESADO";

        if (isInvoiced) {
          await db
            .update(prefacturas)
            .set({
              siigoStatus: "INVOICED",
              siigoInvoiceNumber: invoiceNumber,
              siigoIssuedAt: invoiceDate ? new Date(invoiceDate) : new Date(),
              siigoLastSyncAt: new Date(),
              siigoErrorMessage: null,
            })
            .where(eq(prefacturas.id, pf.id));

          results.push({
            id: pf.id,
            prefacturaCode: pf.prefacturaCode,
            outcome: "INVOICED",
            siigoInvoiceNumber: invoiceNumber,
            siigoIssuedAt: invoiceDate,
            error: null,
          });
          invoicedCount++;
        } else {
          // Still pending in SIIGO — just update sync timestamp
          await db
            .update(prefacturas)
            .set({ siigoLastSyncAt: new Date() })
            .where(eq(prefacturas.id, pf.id));

          results.push({
            id: pf.id,
            prefacturaCode: pf.prefacturaCode,
            outcome: "PENDING",
            siigoInvoiceNumber: invoiceNumber,
            siigoIssuedAt: invoiceDate,
            error: null,
          });
        }
      } catch (pollErr) {
        const errMsg =
          pollErr instanceof SiigoApiError
            ? pollErr.message
            : pollErr instanceof Error
              ? pollErr.message
              : "Error desconocido al consultar SIIGO";

        await db
          .update(prefacturas)
          .set({
            siigoStatus: "ERROR",
            siigoErrorMessage: errMsg,
            siigoLastSyncAt: new Date(),
          })
          .where(eq(prefacturas.id, pf.id));

        results.push({
          id: pf.id,
          prefacturaCode: pf.prefacturaCode,
          outcome: "ERROR",
          siigoInvoiceNumber: null,
          siigoIssuedAt: null,
          error: errMsg,
        });
        errorCount++;
      }
    }

    return Response.json({
      ok: true,
      polled: sentPrefacturas.length,
      invoiced: invoicedCount,
      errors: errorCount,
      results,
    });
  } catch (error) {
    console.error("[prefacturas siigo poll] error:", {
      code: (error as any)?.code,
      message: (error as any)?.message,
    });

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 },
    );
  }
}
