import { asc } from "drizzle-orm";

import { db } from "@/src/db";
import { taxZoneRates } from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "tax-zone-rates:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_RETENCIONES");

  if (forbidden) return forbidden;

  try {
    const items = await db
      .select({
        taxZone: taxZoneRates.taxZone,
        withholdingTaxRate: taxZoneRates.withholdingTaxRate,
        withholdingIcaRate: taxZoneRates.withholdingIcaRate,
        withholdingIvaRate: taxZoneRates.withholdingIvaRate,
        updatedAt: taxZoneRates.updatedAt,
      })
      .from(taxZoneRates)
      .orderBy(asc(taxZoneRates.taxZone));

    return Response.json({ items });
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudieron consultar las tasas", { status: 500 });
  }
}
