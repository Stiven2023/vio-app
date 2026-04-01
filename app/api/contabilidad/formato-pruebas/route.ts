import { z } from "zod";

import {
  buildAccountingQaTemplateCsv,
  buildAccountingQaTemplateFilename,
} from "@/src/utils/accounting-test-format";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

const querySchema = z.object({
  format: z.literal("csv").optional(),
});

function jsonError(
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
) {
  return Response.json(
    {
      code,
      message,
      fieldErrors,
    },
    { status },
  );
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "contabilidad:formato-pruebas:get",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const format = String(searchParams.get("format") ?? "csv").trim();
  const parsed = querySchema.safeParse({ format });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = String(firstIssue?.path?.[0] ?? "format");

    return jsonError(
      400,
      "VALIDATION_ERROR",
      "Parametro de formato invalido. Usa format=csv",
      {
        [field]: ["Solo se admite el formato csv"],
      },
    );
  }

  const csv = buildAccountingQaTemplateCsv();
  const filename = buildAccountingQaTemplateFilename();

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
      "Cache-Control": "no-store",
    },
  });
}