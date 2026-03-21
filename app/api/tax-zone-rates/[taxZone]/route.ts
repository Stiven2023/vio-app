import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { taxZoneValues } from "@/src/db/enums";
import { taxZoneRates } from "@/src/db/schema";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function parseRate(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 100) return null;

  return parsed.toFixed(4);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taxZone: string }> },
) {
  const limited = rateLimit(request, {
    key: "tax-zone-rates:patch",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "GESTIONAR_RETENCIONES");

  if (forbidden) return forbidden;

  try {
    const { taxZone } = await context.params;
    const normalizedTaxZone = String(taxZone ?? "")
      .trim()
      .toUpperCase();

    if (!taxZoneValues.includes(normalizedTaxZone as any)) {
      return new Response("taxZone invalida", { status: 400 });
    }

    const body = await request.json();
    const withholdingTaxRate = parseRate(body?.withholdingTaxRate);
    const withholdingIcaRate = parseRate(body?.withholdingIcaRate);
    const withholdingIvaRate = parseRate(body?.withholdingIvaRate);

    if (
      withholdingTaxRate === null ||
      withholdingIcaRate === null ||
      withholdingIvaRate === null
    ) {
      return new Response("Tasas invalidas", { status: 400 });
    }

    const employeeId = getEmployeeIdFromRequest(request);

    const [updated] = await db
      .update(taxZoneRates)
      .set({
        withholdingTaxRate,
        withholdingIcaRate,
        withholdingIvaRate,
        updatedBy: employeeId,
        updatedAt: new Date(),
      })
      .where(eq(taxZoneRates.taxZone, normalizedTaxZone as any))
      .returning({
        taxZone: taxZoneRates.taxZone,
        withholdingTaxRate: taxZoneRates.withholdingTaxRate,
        withholdingIcaRate: taxZoneRates.withholdingIcaRate,
        withholdingIvaRate: taxZoneRates.withholdingIvaRate,
        updatedAt: taxZoneRates.updatedAt,
      });

    if (!updated) {
      const [created] = await db
        .insert(taxZoneRates)
        .values({
          taxZone: normalizedTaxZone as any,
          withholdingTaxRate,
          withholdingIcaRate,
          withholdingIvaRate,
          updatedBy: employeeId,
        })
        .onConflictDoNothing()
        .returning({ taxZone: taxZoneRates.taxZone });

      if (!created?.taxZone) {
        const [existing] = await db
          .select({ taxZone: taxZoneRates.taxZone })
          .from(taxZoneRates)
          .where(and(eq(taxZoneRates.taxZone, normalizedTaxZone as any)))
          .limit(1);

        if (!existing?.taxZone) {
          return new Response("No se pudo guardar la tasa", { status: 500 });
        }
      }

      const [fresh] = await db
        .select({
          taxZone: taxZoneRates.taxZone,
          withholdingTaxRate: taxZoneRates.withholdingTaxRate,
          withholdingIcaRate: taxZoneRates.withholdingIcaRate,
          withholdingIvaRate: taxZoneRates.withholdingIvaRate,
          updatedAt: taxZoneRates.updatedAt,
        })
        .from(taxZoneRates)
        .where(eq(taxZoneRates.taxZone, normalizedTaxZone as any))
        .limit(1);

      return Response.json(fresh);
    }

    return Response.json(updated);
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo actualizar la tasa", { status: 500 });
  }
}
