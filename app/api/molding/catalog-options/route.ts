import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { moldingCatalogOptions } from "@/src/db/schema";
import { jsonError, zodFirstErrorEnvelope } from "@/src/utils/api-error";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

const createOptionSchema = z.object({
  fieldKey: z.string().trim().min(1).max(80),
  value: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .transform((v) => v.toUpperCase()),
  label: z.string().trim().max(120).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: Request): Promise<Response> {
  const limited = rateLimit(request, {
    key: "molding-catalog-options:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MOLDERIA");

  if (forbidden) return forbidden;

  try {
    const { searchParams } = new URL(request.url);
    const fieldKey = searchParams.get("fieldKey")?.trim();
    const activeOnly = searchParams.get("activeOnly") !== "false";
    // Support fetching multiple keys at once: ?fieldKeys=neckType,sleeveType,...
    const fieldKeysParam = searchParams.get("fieldKeys")?.trim();

    // Single fieldKey mode
    if (fieldKey) {
      const conditions = [eq(moldingCatalogOptions.fieldKey, fieldKey)];

      if (activeOnly) {
        conditions.push(eq(moldingCatalogOptions.isActive, true));
      }

      const options = await db
        .select()
        .from(moldingCatalogOptions)
        .where(and(...conditions))
        .orderBy(
          asc(moldingCatalogOptions.sortOrder),
          asc(moldingCatalogOptions.value),
        );

      return Response.json({ options });
    }

    // Multi-key mode: ?fieldKeys=a,b,c or ?fieldKeys=* (all)
    const KNOWN_FIELD_KEYS = [
      "tipoAplique",
      "embroideryTechnique",
      "marquillaType",
      "neckType",
      "sesgoType",
      "sleeveType",
      "cuffType",
      "liningType",
      "hoodType",
      "buttonType",
      "buttonholeType",
      "pocketConfig",
    ];

    const requestedKeys =
      !fieldKeysParam || fieldKeysParam === "*"
        ? KNOWN_FIELD_KEYS
        : fieldKeysParam
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean);

    const conditions = [inArray(moldingCatalogOptions.fieldKey, requestedKeys)];

    if (activeOnly) {
      conditions.push(eq(moldingCatalogOptions.isActive, true));
    }

    const rows = await db
      .select()
      .from(moldingCatalogOptions)
      .where(and(...conditions))
      .orderBy(
        asc(moldingCatalogOptions.sortOrder),
        asc(moldingCatalogOptions.value),
      );

    // Group by fieldKey
    const grouped: Record<string, { value: string; label: string | null }[]> =
      {};

    for (const row of rows) {
      if (!grouped[row.fieldKey]) grouped[row.fieldKey] = [];
      grouped[row.fieldKey].push({ value: row.value, label: row.label });
    }

    return Response.json({ grouped });
  } catch (err) {
    const errResponse = dbErrorResponse(err);

    if (errResponse) return errResponse;

    return new Response("Error al consultar opciones de catálogo", {
      status: 500,
    });
  }
}

export async function POST(request: Request): Promise<Response> {
  const limited = rateLimit(request, {
    key: "molding-catalog-options:post",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_MOLDERIA");

  if (forbidden) return forbidden;

  try {
    const body = await request.json();
    const parsed = createOptionSchema.safeParse(body);

    if (parsed.error) {
      return zodFirstErrorEnvelope(
        parsed.error,
        "Datos inválidos para crear opción.",
      );
    }

    const { fieldKey, value, label, sortOrder } = parsed.data;

    const existing = await db
      .select({ id: moldingCatalogOptions.id })
      .from(moldingCatalogOptions)
      .where(
        and(
          eq(moldingCatalogOptions.fieldKey, fieldKey),
          eq(moldingCatalogOptions.value, value),
        ),
      );

    if (existing.length > 0) {
      return jsonError(
        409,
        "CONFLICT",
        "Ya existe una opción con ese valor para este campo.",
      );
    }

    const [created] = await db
      .insert(moldingCatalogOptions)
      .values({ fieldKey, value, label: label ?? null, sortOrder })
      .returning();

    return Response.json({ option: created }, { status: 201 });
  } catch (err) {
    const errResponse = dbErrorResponse(err);

    if (errResponse) return errResponse;

    return new Response("Error al crear opción de catálogo", { status: 500 });
  }
}
