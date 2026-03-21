import { db } from "@/src/db";
import { clients } from "@/src/db/schema";
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
    key: "clients:export:get",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CLIENTE");

  if (forbidden) return forbidden;

  try {
    const rows = await db
      .select({
        clientCode: clients.clientCode,
        clientType: clients.clientType,
        name: clients.name,
        identificationType: clients.identificationType,
        identification: clients.identification,
        dv: clients.dv,
        taxRegime: clients.taxRegime,
        contactName: clients.contactName,
        email: clients.email,
        address: clients.address,
        city: clients.city,
        department: clients.department,
        country: clients.country,
        mobile: clients.mobile,
        isActive: clients.isActive,
      })
      .from(clients)
      .orderBy(clients.clientCode);

    const headers = [
      "clientCode",
      "clientType",
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
      "country",
      "mobile",
      "isActive",
    ].join(";");

    const dataLines = rows.map((row) =>
      [
        escapeCsvCell(row.clientCode),
        escapeCsvCell(row.clientType),
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
        escapeCsvCell(row.country),
        escapeCsvCell(row.mobile),
        row.isActive ? "SI" : "NO",
      ].join(";")
    );

    const csv = [headers, ...dataLines].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=clients-export.csv",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;

    return new Response("No se pudo exportar clientes", { status: 500 });
  }
}
