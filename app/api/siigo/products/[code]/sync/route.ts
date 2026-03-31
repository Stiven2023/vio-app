import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { products } from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { SiigoApiError, siigoJson } from "@/src/utils/siigo";
import { buildSiigoProductPayload } from "@/src/utils/siigo-products";

type SiigoProductResponse = {
  id?: unknown;
};

// ── POST: sync a single product to SIIGO by product code ──────────────────────

export async function POST(
  request: Request,
  props: { params: Promise<{ code: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "siigo:products:sync-one",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const productCode = String(params.code ?? "").trim().toUpperCase();

  if (!productCode) {
    return Response.json(
      { error: "Código de producto requerido." },
      { status: 400 },
    );
  }

  const rawAccountGroup = process.env.SIIGO_PRODUCT_ACCOUNT_GROUP;

  if (!rawAccountGroup?.trim()) {
    return Response.json(
      {
        error:
          "Falta la variable de entorno SIIGO_PRODUCT_ACCOUNT_GROUP. Configúrala con el ID del grupo de cuentas de productos en SIIGO.",
      },
      { status: 503 },
    );
  }

  const accountGroup = parseInt(rawAccountGroup.trim(), 10);

  if (!Number.isFinite(accountGroup) || accountGroup <= 0) {
    return Response.json(
      { error: "SIIGO_PRODUCT_ACCOUNT_GROUP debe ser un número entero positivo." },
      { status: 503 },
    );
  }

  const [product] = await db
    .select({
      id: products.id,
      productCode: products.productCode,
      name: products.name,
      priceCopBase: products.priceCopBase,
      siigoSynced: products.siigoSynced,
      siigoId: products.siigoId,
    })
    .from(products)
    .where(eq(products.productCode, productCode))
    .limit(1);

  if (!product) {
    return Response.json(
      { error: `Producto con código "${productCode}" no encontrado.` },
      { status: 404 },
    );
  }

  if (product.siigoSynced && product.siigoId) {
    return Response.json({
      ok: true,
      already: true,
      productCode: product.productCode,
      siigoId: product.siigoId,
    });
  }

  const payload = await buildSiigoProductPayload(product, accountGroup);

  try {
    const result = await siigoJson<SiigoProductResponse>("/v1/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const siigoId = String(result.id ?? "").trim();

    if (!siigoId) {
      await db
        .update(products)
        .set({ siigoSyncError: "SIIGO no devolvió un ID de producto." })
        .where(eq(products.id, product.id));

      return Response.json(
        { error: "SIIGO no devolvió un ID de producto." },
        { status: 502 },
      );
    }

    await db
      .update(products)
      .set({
        siigoId,
        siigoSynced: true,
        siigoSyncedAt: new Date(),
        siigoSyncError: null,
      })
      .where(eq(products.id, product.id));

    return Response.json({
      ok: true,
      productCode: product.productCode,
      siigoId,
    });
  } catch (err) {
    let message = "Error al crear producto en SIIGO.";

    if (err instanceof SiigoApiError) {
      const body = err.payload as Record<string, unknown>;
      const errors = body?.Errors as unknown[] | undefined;
      const firstError = errors?.[0] as Record<string, unknown> | undefined;

      message =
        String(
          firstError?.Message ??
            firstError?.message ??
            body?.message ??
            err.message,
        ) || message;
    } else {
      message = String((err as Error)?.message ?? message);
    }

    await db
      .update(products)
      .set({ siigoSyncError: message })
      .where(eq(products.id, product.id));

    return Response.json({ error: message }, { status: 502 });
  }
}
