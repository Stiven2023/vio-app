import { db } from "@/src/db";
import { employees } from "@/src/db/erp/schema";
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
    key: "employees:export:get",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_EMPLEADO");

  if (forbidden) return forbidden;

  try {
    const rows = await db
      .select({
        employeeCode: employees.employeeCode,
        name: employees.name,
        identificationType: employees.identificationType,
        identification: employees.identification,
        email: employees.email,
        mobile: employees.mobile,
        address: employees.address,
        city: employees.city,
        department: employees.department,
        contractType: employees.contractType,
        isActive: employees.isActive,
      })
      .from(employees)
      .orderBy(employees.employeeCode);

    const headers = [
      "employeeCode",
      "name",
      "identificationType",
      "identification",
      "email",
      "mobile",
      "address",
      "city",
      "department",
      "contractType",
      "isActive",
    ].join(";");

    const dataLines = rows.map((row) =>
      [
        escapeCsvCell(row.employeeCode),
        escapeCsvCell(row.name),
        escapeCsvCell(row.identificationType),
        escapeCsvCell(row.identification),
        escapeCsvCell(row.email),
        escapeCsvCell(row.mobile),
        escapeCsvCell(row.address),
        escapeCsvCell(row.city),
        escapeCsvCell(row.department),
        escapeCsvCell(row.contractType),
        row.isActive ? "SI" : "NO",
      ].join(";")
    );

    const csv = [headers, ...dataLines].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=employees-export.csv",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;

    return new Response("No se pudo exportar empleados", { status: 500 });
  }
}
