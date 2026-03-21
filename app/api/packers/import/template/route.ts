import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "packers:import:template:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_EMPAQUE");

  if (forbidden) return forbidden;

  const header = [
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

  const sampleCreateRow = [
    "",
    "EMPAQUES DEL SUR S.A.S",
    "NIT",
    "890123456",
    "Satélite",
    "Prenda colgada",
    "PEDRO RAMIREZ",
    "pedro@empaquesdelsur.com",
    "3201234567",
    "CLL 50 # 30-10",
    "Medellín",
    "SI",
  ].join(";");

  const sampleEditRow = [
    "EMPA1001",
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
    "# packerCode vacío = CREACIÓN (se genera código automáticamente, ej: EMPA1001).",
    "# packerCode con valor = EDICIÓN del empaquetador existente con ese código.",
    "# identificationType: CC, NIT, CE, PAS, EMPRESA_EXTERIOR.",
    "# isActive: SI/NO (también true/false/1/0). En edición, vacío = no cambia.",
    "# En creación son obligatorios: name, identificationType, identification, address.",
  ];

  const csv = [header, sampleCreateRow, sampleEditRow, ...notes].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=packers-import-template.csv",
      "Cache-Control": "no-store",
    },
  });
}
