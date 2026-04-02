import { db } from "@/src/db";
import { suppliers } from "@/src/db/erp/schema";
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
    key: "suppliers:export:get",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PROVEEDOR");

  if (forbidden) return forbidden;

  try {
    const rows = await db
      .select({
        supplierCode: suppliers.supplierCode,
        name: suppliers.name,
        identificationType: suppliers.identificationType,
        identification: suppliers.identification,
        dv: suppliers.dv,
        taxRegime: suppliers.taxRegime,
        contactName: suppliers.contactName,
        email: suppliers.email,
        address: suppliers.address,
        city: suppliers.city,
        department: suppliers.department,
        mobile: suppliers.mobile,
        isActive: suppliers.isActive,
      })
      .from(suppliers)
      .orderBy(suppliers.supplierCode);

    const headers = [
      "supplierCode",
      "name",
      "identificationType",
      "identification",
      "dv",
      "taxRegime",
      "contactName",
      "email",
      "address",
      "city",
      "department",
      "mobile",
      "isActive",
    ].join(";");

    const dataLines = rows.map((row) =>
      [
        escapeCsvCell(row.supplierCode),
        escapeCsvCell(row.name),
        escapeCsvCell(row.identificationType),
        escapeCsvCell(row.identification),
        escapeCsvCell(row.dv),
        escapeCsvCell(row.taxRegime),
        escapeCsvCell(row.contactName),
        escapeCsvCell(row.email),
        escapeCsvCell(row.address),
        escapeCsvCell(row.city),
        escapeCsvCell(row.department),
        escapeCsvCell(row.mobile),
        row.isActive ? "SI" : "NO",
      ].join(";")
    );

    const csv = [headers, ...dataLines].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=suppliers-export.csv",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;

    return new Response("No se pudo exportar proveedores", { status: 500 });
  }
}
