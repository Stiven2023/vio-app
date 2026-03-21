import { db } from "@/src/db";
import { packers } from "@/src/db/schema";
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
    key: "packers:export:get",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_EMPAQUE");

  if (forbidden) return forbidden;

  try {
    const rows = await db
      .select({
        packerCode: packers.packerCode,
        name: packers.name,
        identificationType: packers.identificationType,
        identification: packers.identification,
        packerType: packers.packerType,
        specialty: packers.specialty,
        contactName: packers.contactName,
        email: packers.email,
        mobile: packers.mobile,
        address: packers.address,
        city: packers.city,
        isActive: packers.isActive,
      })
      .from(packers)
      .orderBy(packers.packerCode);

    const headers = [
      "packerCode",
      "name",
      "identificationType",
      "identification",
      "packerType",
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
        escapeCsvCell(row.packerCode),
        escapeCsvCell(row.name),
        escapeCsvCell(row.identificationType),
        escapeCsvCell(row.identification),
        escapeCsvCell(row.packerType),
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
        "Content-Disposition": "attachment; filename=packers-export.csv",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;

    return new Response("No se pudo exportar empaquetadores", { status: 500 });
  }
}
