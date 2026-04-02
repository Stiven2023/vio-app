import { and, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { products } from "@/src/db/erp/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { SiigoApiError, siigoJson } from "@/src/utils/siigo";
import { buildSiigoProductPayload } from "@/src/utils/siigo-products";

type SiigoProductResponse = {
  id?: unknown;
  code?: unknown;
  name?: unknown;
  active?: unknown;
};

type SiigoProductsPage = {
  pagination?: { total_results?: unknown };
  results?: unknown[];
};

// ── GET: list products with SIIGO sync status ──────────────────────────────────

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "siigo:products:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const unsyncedOnly = url.searchParams.get("unsynced") === "1";

  const conditions = unsyncedOnly
    ? [eq(products.siigoSynced, false)]
    : [];

  const rows = await db
    .select({
      id: products.id,
      productCode: products.productCode,
      name: products.name,
      isActive: products.isActive,
      siigoId: products.siigoId,
      siigoSynced: products.siigoSynced,
      siigoSyncedAt: products.siigoSyncedAt,
      siigoSyncError: products.siigoSyncError,
    })
    .from(products)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(products.productCode);

  return Response.json(rows);
}

// ── POST: bulk-sync all unsynced products to SIIGO ────────────────────────────

function getSiigoProductAccountGroup(): number {
  const raw = process.env.SIIGO_PRODUCT_ACCOUNT_GROUP;

  if (!raw || !raw.trim()) {
    throw new Error(
      "Falta la variable de entorno SIIGO_PRODUCT_ACCOUNT_GROUP. Configúrala con el ID del grupo de cuentas de productos en SIIGO.",
    );
  }

  const value = parseInt(raw.trim(), 10);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      "SIIGO_PRODUCT_ACCOUNT_GROUP debe ser un número entero positivo.",
    );
  }

  return value;
}

async function syncProductToSiigo(
  product: {
    id: string;
    productCode: string;
    name: string;
    priceCopBase?: string | null;
  },
  accountGroup: number,
): Promise<{ siigoId: string } | { error: string }> {
  const payload = await buildSiigoProductPayload(product, accountGroup);

  try {
    const result = await siigoJson<SiigoProductResponse>("/v1/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const siigoId = String(result.id ?? "").trim();

    if (!siigoId) {
      return { error: "SIIGO no devolvió un ID de producto." };
    }

    return { siigoId };
  } catch (err) {
    if (err instanceof SiigoApiError) {
      const body = err.payload as Record<string, unknown>;
      const errors = body?.Errors as unknown[] | undefined;
      const firstError = errors?.[0] as Record<string, unknown> | undefined;
      const message =
        String(
          firstError?.Message ??
            firstError?.message ??
            body?.message ??
            err.message,
        ) || "Error al crear producto en SIIGO.";

      return { error: message };
    }

    return { error: String((err as Error)?.message ?? "Error desconocido.") };
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "siigo:products:sync-all",
    limit: 10,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  let accountGroup: number;

  try {
    accountGroup = getSiigoProductAccountGroup();
  } catch (err) {
    return Response.json(
      { error: String((err as Error)?.message ?? "Configuración inválida.") },
      { status: 503 },
    );
  }

  // Get all active unsynced products
  const unsynced = await db
    .select({
      id: products.id,
      productCode: products.productCode,
      name: products.name,
      priceCopBase: products.priceCopBase,
    })
    .from(products)
    .where(
      and(eq(products.isActive, true), eq(products.siigoSynced, false)),
    );

  if (unsynced.length === 0) {
    return Response.json({ synced: 0, errors: [], total: 0 });
  }

  const results = {
    total: unsynced.length,
    synced: 0,
    errors: [] as Array<{ productCode: string; error: string }>,
  };

  for (const product of unsynced) {
    const result = await syncProductToSiigo(product, accountGroup);

    if ("siigoId" in result) {
      await db
        .update(products)
        .set({
          siigoId: result.siigoId,
          siigoSynced: true,
          siigoSyncedAt: new Date(),
          siigoSyncError: null,
        })
        .where(eq(products.id, product.id));
      results.synced++;
    } else {
      await db
        .update(products)
        .set({
          siigoSynced: false,
          siigoSyncError: result.error,
        })
        .where(eq(products.id, product.id));
      results.errors.push({
        productCode: product.productCode,
        error: result.error,
      });
    }
  }

  return Response.json(results);
}
