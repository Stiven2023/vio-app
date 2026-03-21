import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "suppliers:import:template:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PROVEEDOR");

  if (forbidden) return forbidden;

  const header = [
    "supplierCode",
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
    "mobile",
    "isActive",
  ].join(";");

  const sampleCreateRow = [
    "",
    "CONFECCIONES EL TIEMPO S.A.S",
    "NIT",
    "900123456",
    "3",
    "REGIMEN_COMUN",
    "CARLOS LOPEZ",
    "carlos@eltiemp.com",
    "CRA 45 # 10-20",
    "050010",
    "Medellín",
    "ANTIOQUIA",
    "3109876543",
    "SI",
  ].join(";");

  const sampleEditRow = [
    "PROV1001",
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
    "# supplierCode vacío = CREACIÓN (se genera código automáticamente, ej: PROV1001).",
    "# supplierCode con valor = EDICIÓN del proveedor existente con ese código.",
    "# identificationType: CC, NIT, CE, PAS, EMPRESA_EXTERIOR.",
    "# taxRegime: REGIMEN_COMUN, REGIMEN_SIMPLIFICADO, NO_RESPONSABLE.",
    "# isActive: SI/NO (también true/false/1/0). En edición, vacío = no cambia.",
    "# En creación son obligatorios: name, identificationType, identification, taxRegime, contactName, email, address.",
  ];

  const csv = [header, sampleCreateRow, sampleEditRow, ...notes].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=suppliers-import-template.csv",
      "Cache-Control": "no-store",
    },
  });
}
