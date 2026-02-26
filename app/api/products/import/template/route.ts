import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "products:import:template:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  const header = [
    "productCode",
    "categoryName",
    "name",
    "description",
    "priceCopBase",
    "priceCopR1",
    "priceCopR2",
    "priceCopR3",
    "priceMayorista",
    "priceColanta",
    "isActive",
  ].join(";");

  const sampleRow = [
    "",
    "CAMISETAS",
    "CAMISETA MC UNISEX",
    "Producto importado por plantilla",
    "25000",
    "25000",
    "23500",
    "22000",
    "21000",
    "21500",
    "",
  ].join(";");

  const sampleEditRow = [
    "CAM01",
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
    "# Nota: puedes enviar categoryId o categoryName; se recomienda categoryName.",
    "# categoryName se normaliza (MAYÚSCULAS, sin tildes ni símbolos) y se compara con categorías existentes.",
    "# productCode vacío = CREACIÓN (se genera código automáticamente).",
    "# productCode con valor = EDICIÓN del producto existente con ese código.",
    "# En edición, isActive acepta SI/NO (también true/false/1/0). Vacío = no cambia.",
    "# startDate y endDate NO se envían: se crean automáticamente.",
    "# Vigencia automática: desde la fecha de importación hasta el 1 de febrero del próximo año.",
  ];

  const csv = [header, sampleRow, sampleEditRow, ...notes].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=products-import-template.csv",
      "Cache-Control": "no-store",
    },
  });
}
