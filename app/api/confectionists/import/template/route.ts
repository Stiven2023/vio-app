import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "confectionists:import:template:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_CONFECCIONISTA");

  if (forbidden) return forbidden;

  const header = [
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

  const sampleCreateRow = [
    "",
    "TALLER MODAS EXPRESS",
    "NIT",
    "800987654",
    "REGIMEN_SIMPLIFICADO",
    "Taller Externo",
    "Camisetas",
    "MARIA GOMEZ",
    "maria@modas.com",
    "3154567890",
    "CRA 23 # 45-67",
    "Medellín",
    "SI",
  ].join(";");

  const sampleEditRow = [
    "CON1001",
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
    "# confectionistCode vacío = CREACIÓN (se genera código automáticamente, ej: CON1001).",
    "# confectionistCode con valor = EDICIÓN del confeccionista existente con ese código.",
    "# identificationType: CC, NIT, CE, PAS, EMPRESA_EXTERIOR.",
    "# taxRegime: REGIMEN_COMUN, REGIMEN_SIMPLIFICADO, NO_RESPONSABLE.",
    "# isActive: SI/NO (también true/false/1/0). En edición, vacío = no cambia.",
    "# En creación son obligatorios: name, identificationType, identification, taxRegime, address.",
  ];

  const csv = [header, sampleCreateRow, sampleEditRow, ...notes].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        "attachment; filename=confectionists-import-template.csv",
      "Cache-Control": "no-store",
    },
  });
}
