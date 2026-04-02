import { db } from "@/src/db";
import { clients } from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { and, eq, ilike, or, SQL } from "drizzle-orm";

const EXPORT_MAX_ROWS = 10_000;

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
    limit: 10,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CLIENTE");

  if (forbidden) return forbidden;

  const sp = new URL(request.url).searchParams;
  const isActiveParam = sp.get("isActive");
  const search = sp.get("search")?.trim() ?? "";

  const filters: SQL[] = [];

  if (isActiveParam === "true") {
    filters.push(eq(clients.isActive, true));
  } else if (isActiveParam === "false") {
    filters.push(eq(clients.isActive, false));
  }

  if (search) {
    filters.push(
      or(
        ilike(clients.name, `%${search}%`),
        ilike(clients.clientCode, `%${search}%`),
        ilike(clients.identification, `%${search}%`)
      ) as SQL
    );
  }

  try {
    // Fetch one extra row to detect truncation without a separate COUNT query
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
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(clients.clientCode)
      .limit(EXPORT_MAX_ROWS + 1);

    const truncated = rows.length > EXPORT_MAX_ROWS;
    const exportRows = truncated ? rows.slice(0, EXPORT_MAX_ROWS) : rows;

    const csvHeaders = [
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

    const dataLines = exportRows.map((row) =>
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

    const csv = [csvHeaders, ...dataLines].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=clients-export.csv",
        "Cache-Control": "no-store",
        "X-Export-Row-Count": String(exportRows.length),
        "X-Export-Truncated": String(truncated),
      },
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;

    return new Response("No se pudo exportar clientes", { status: 500 });
  }
}
