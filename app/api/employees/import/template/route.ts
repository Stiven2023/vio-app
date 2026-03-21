import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "employees:import:template:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_EMPLEADO");

  if (forbidden) return forbidden;

  const header = [
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

  const sampleCreateRow = [
    "",
    "ANA MARIA RUIZ",
    "CC",
    "43210987",
    "ana@empresa.com",
    "3156789012",
    "CRA 80 # 45-12",
    "Medellín",
    "ANTIOQUIA",
    "TERMINO_INDEFINIDO",
    "SI",
  ].join(";");

  const sampleEditRow = [
    "EMP1001",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "NO",
  ].join(";");

  const notes = [
    "# employeeCode vacío = CREACIÓN (se genera código automáticamente, ej: EMP1001).",
    "# employeeCode con valor = EDICIÓN del empleado existente con ese código.",
    "# identificationType: CC, NIT, CE, PAS, EMPRESA_EXTERIOR.",
    "# contractType: TERMINO_FIJO, TERMINO_INDEFINIDO, PRESTACION_SERVICIOS, OBRA_LABOR, APRENDIZAJE.",
    "# isActive: SI/NO (también true/false/1/0). En edición, vacío = no cambia.",
    "# En creación son obligatorios: name, identificationType, identification, email, address.",
    "# NOTA: La importación NO crea cuenta de usuario. Solo registra el empleado.",
  ];

  const csv = [header, sampleCreateRow, sampleEditRow, ...notes].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=employees-import-template.csv",
      "Cache-Control": "no-store",
    },
  });
}
