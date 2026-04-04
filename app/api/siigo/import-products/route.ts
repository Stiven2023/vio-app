import { inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { categories, products } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { SiigoApiError, siigoJson } from "@/src/utils/siigo";

// ── Tipos raw de SIIGO ────────────────────────────────────────────────────────

type SiigoProductRaw = {
  id?: unknown;
  code?: unknown;
  name?: unknown;
  active?: unknown;
};

type SiigoProductsPage = {
  pagination?: { total_results?: unknown };
  results?: unknown[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  const s = String(v ?? "").trim();

  return s || null;
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;

  return (
    String(v ?? "")
      .trim()
      .toLowerCase() === "true"
  );
}

type NormalizedProduct = {
  siigoId: string;
  siigoCode: string;
  name: string;
  active: boolean;
};

function normalizeProduct(raw: unknown): NormalizedProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as SiigoProductRaw;
  const siigoId = str(r.id);
  const name = str(r.name);

  if (!siigoId || !name) return null;

  return {
    siigoId,
    siigoCode: str(r.code) ?? siigoId.slice(0, 10),
    name,
    active: toBool(r.active),
  };
}

/**
 * Construye un productCode de máx 10 chars a partir del código SIIGO.
 * Si el código ya está ocupado por otro producto, añade un sufijo numérico.
 */
function buildProductCode(
  siigoCode: string,
  occupiedCodes: Set<string>,
): string {
  const base = siigoCode
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8);
  const candidate = base.padEnd(4, "X").slice(0, 10);

  if (!occupiedCodes.has(candidate)) return candidate;

  // Intenta con sufijo numérico
  for (let i = 1; i <= 99; i++) {
    const suffix = String(i).padStart(2, "0");
    const withSuffix = `${base.slice(0, 8)}${suffix}`.slice(0, 10);

    if (!occupiedCodes.has(withSuffix)) return withSuffix;
  }

  // Fallback: usar los primeros 8 chars del siigoCode limpio
  return `SG${siigoCode.replace(/\D/g, "").slice(0, 8)}`.slice(0, 10);
}

// ── Resultado público ─────────────────────────────────────────────────────────

export type ImportProductsStats = {
  ok: true;
  total: number;
  created: number;
  skipped: number;
  errors: Array<{ siigoId: string; name: string; reason: string }>;
  durationMs: number;
};

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "siigo:import-products",
    limit: 5,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const startMs = Date.now();

  try {
    // 1 ── Descargar todos los productos paginados desde SIIGO ─────────────────
    const allRaw: unknown[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
      const data = await siigoJson<SiigoProductsPage>(
        `/v1/products?page=${page}&page_size=${pageSize}`,
      );

      const results = Array.isArray(data?.results) ? data.results : [];

      allRaw.push(...results);

      const total = Number(data?.pagination?.total_results ?? 0);

      if (allRaw.length >= total || results.length < pageSize) break;

      page++;
    }

    // 2 ── Normalizar ──────────────────────────────────────────────────────────
    const normalized = allRaw
      .map(normalizeProduct)
      .filter((p): p is NormalizedProduct => Boolean(p));

    if (normalized.length === 0) {
      return Response.json({
        ok: true,
        total: 0,
        created: 0,
        skipped: 0,
        errors: [],
        durationMs: Date.now() - startMs,
      } satisfies ImportProductsStats);
    }

    // 3 ── Cargar productos existentes para deduplicar ─────────────────────────
    const siigoIds = normalized
      .map((p) => p.siigoId)
      .filter((id): id is string => Boolean(id));

    // Buscar por siigoId en lote
    const bySiigoId =
      siigoIds.length > 0
        ? await db
            .select({ siigoId: products.siigoId, name: products.name })
            .from(products)
            .where(inArray(products.siigoId, siigoIds))
        : [];

    const existingSiigoIds = new Set(
      bySiigoId.map((r) => r.siigoId).filter(Boolean),
    );

    // Obtener todos los nombres y códigos existentes para dedup y code-collision
    const allExisting = await db
      .select({
        name: products.name,
        productCode: products.productCode,
      })
      .from(products);

    const existingNamesLower = new Set(
      allExisting.map((r) => r.name.trim().toLowerCase()),
    );
    const occupiedCodes = new Set(
      allExisting.map((r) => r.productCode).filter(Boolean),
    );

    // 3.5 ── Obtener o crear categoría "OTROS" ───────────────────────────────
    let otrosCategoryId: string | undefined;

    const existingOtros = await db
      .select({ id: categories.id })
      .from(categories)
      .where(sql`lower(name) = 'otros'`);

    if (existingOtros.length > 0) {
      otrosCategoryId = existingOtros[0]?.id;
    } else {
      const [newCategory] = await db
        .insert(categories)
        .values({ name: "OTROS" })
        .returning({ id: categories.id });

      otrosCategoryId = newCategory?.id;
    }

    // 4 ── Insertar solo los que no existen ────────────────────────────────────
    let created = 0;
    let skipped = 0;
    const errors: ImportProductsStats["errors"] = [];

    for (const p of normalized) {
      // Deduplicar por siigoId y por nombre (case-insensitive)
      if (
        existingSiigoIds.has(p.siigoId) ||
        existingNamesLower.has(p.name.trim().toLowerCase())
      ) {
        skipped++;
        continue;
      }

      try {
        const productCode = buildProductCode(p.siigoCode, occupiedCodes);

        occupiedCodes.add(productCode); // reservar para el próximo iteración

        await db.insert(products).values({
          productCode,
          name: p.name.slice(0, 255),
          isActive: p.active,
          categoryId: otrosCategoryId,
          siigoId: p.siigoId,
          siigoSynced: true,
          siigoSyncedAt: new Date(),
        });

        existingNamesLower.add(p.name.trim().toLowerCase()); // evitar duplicados en la misma corrida
        existingSiigoIds.add(p.siigoId);
        created++;
      } catch (err) {
        errors.push({
          siigoId: p.siigoId,
          name: p.name,
          reason:
            err instanceof Error
              ? err.message
              : "Error desconocido al insertar",
        });
      }
    }

    return Response.json({
      ok: true,
      total: normalized.length,
      created,
      skipped,
      errors,
      durationMs: Date.now() - startMs,
    } satisfies ImportProductsStats);
  } catch (err) {
    if (err instanceof SiigoApiError) {
      return Response.json(
        { error: `Error SIIGO: ${err.message}` },
        { status: 502 },
      );
    }

    return Response.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 },
    );
  }
}
