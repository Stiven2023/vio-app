import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "clients:import:template:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CLIENTE");

  if (forbidden) return forbidden;

  const header = [
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
    "postalCode",
    "city",
    "department",
    "country",
    "mobile",
    "isActive",
  ].join(";");

  const sampleCreateRow = [
    "",
    "NACIONAL",
    "JUAN PEREZ",
    "CC",
    "12345678",
    "",
    "NO_RESPONSABLE",
    "JUAN PEREZ",
    "juan@ejemplo.com",
    "CRA 10 # 20-30",
    "050001",
    "Medellín",
    "ANTIOQUIA",
    "COLOMBIA",
    "3001234567",
    "SI",
  ].join(";");

  const sampleEditRow = [
    "CN10001",
    "",
    "",
    "",
    "",
    "",
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
    "# clientCode vacío = CREACIÓN (se genera código automáticamente).",
    "# clientCode con valor = EDICIÓN del cliente existente con ese código.",
    "# clientType: NACIONAL, EXTRANJERO, EMPLEADO (default: NACIONAL si se omite).",
    "# identificationType: CC, NIT, CE, PAS, EMPRESA_EXTERIOR.",
    "# taxRegime: REGIMEN_COMUN, REGIMEN_SIMPLIFICADO, NO_RESPONSABLE.",
    "# isActive: SI/NO (también true/false/1/0). En edición, vacío = no cambia.",
    "# En creación son obligatorios: name, identificationType, identification, taxRegime, contactName, email, address.",
  ];

  const csv = [header, sampleCreateRow, sampleEditRow, ...notes].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=clients-import-template.csv",
      "Cache-Control": "no-store",
    },
  });
}
