import { db } from "@/src/db";
import { confectionists } from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function escapeCsvCell(val: string | null | undefined): string {
  const str = String(val ?? "");
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "confectionists:export:get",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CONFECCIONISTA");

  if (forbidden) return forbidden;

  try {
    const rows = await db
      .select({
        confectionistCode: confectionists.confectionistCode,
        name: confectionists.name,
        identificationType: confectionists.identificationType,
        identification: confectionists.identification,
        taxRegime: confectionists.taxRegime,
        type: confectionists.type,
        specialty: confectionists.specialty,
        contactName: confectionists.contactName,
        email: confectionists.email,
        mobile: confectionists.mobile,
        address: confectionists.address,
        city: confectionists.city,
        isActive: confectionists.isActive,
      })
      .from(confectionists)
      .orderBy(confectionists.confectionistCode);

    const headers = [
      "confectionistCode",
      "name",
      "identificationType",
      "identification",
      "taxRegime",
      "type",
      "specialty",
      "contactName",
      "email",
      "mobile",
      "address",
      "city",
      "isActive",
    ].join(";");

    const dataLines = rows.map((row) =>
      [
        escapeCsvCell(row.confectionistCode),
        escapeCsvCell(row.name),
        escapeCsvCell(row.identificationType),
        escapeCsvCell(row.identification),
        escapeCsvCell(row.taxRegime),
        escapeCsvCell(row.type),
        escapeCsvCell(row.specialty),
        escapeCsvCell(row.contactName),
        escapeCsvCell(row.email),
        escapeCsvCell(row.mobile),
        escapeCsvCell(row.address),
        escapeCsvCell(row.city),
        row.isActive ? "SI" : "NO",
      ].join(";")
    );

    const csv = [headers, ...dataLines].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=confectionists-export.csv",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;

    return new Response("No se pudo exportar confeccionistas", { status: 500 });
  }
}
