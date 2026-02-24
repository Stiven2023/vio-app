import { eq } from "drizzle-orm";

import { db } from "@/src/db";
import { additions } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const limited = rateLimit(request, {
    key: "additions:get:id",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_INVENTARIO");

  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const [item] = await db
      .select()
      .from(additions)
      .where(eq(additions.id, id))
      .limit(1);

    if (!item)
      return new Response("Addition not found", { status: 404 });

    return Response.json(item);
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;
    return new Response("No se pudo consultar la adición", { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const limited = rateLimit(request, {
    key: "additions:put:id",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_ITEM_INVENTARIO");

  if (forbidden) return forbidden;

  const body = await request.json();

  // Forward to main route handler with ID in body
  const { id } = await params;
  const mainRequest = new Request(new URL("/api/additions", request.url), {
    method: "PUT",
    headers: request.headers,
    body: JSON.stringify({ ...body, id }),
  });

  const mainModule = await import("../route");
  return mainModule.PUT(mainRequest);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const limited = rateLimit(request, {
    key: "additions:delete:id",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(
    request,
    "ELIMINAR_ITEM_INVENTARIO",
  );

  if (forbidden) return forbidden;

  const { id } = await params;
  const mainRequest = new Request(new URL("/api/additions", request.url), {
    method: "DELETE",
    headers: request.headers,
    body: JSON.stringify({ id }),
  });

  const mainModule = await import("../route");
  return mainModule.DELETE(mainRequest);
}
