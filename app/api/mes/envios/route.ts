/**
 * GET    /api/mes/envios?orderId=<uuid>   - list envios for an order
 * POST   /api/mes/envios                  - create a new envio (with items)
 */
import { desc, eq, inArray, sql } from "drizzle-orm";

import { erpDb, mesDb } from "@/src/db";
import { orderItems } from "@/src/db/erp/schema";
import { mesShipmentItems, mesShipments } from "@/src/db/mes/schema";
import {
  mesShipmentAreaValues,
  mesTransportTypeValues,
} from "@/src/db/enums";
import { requirePermission } from "@/src/utils/permission-middleware";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import { parsePaginationStrict } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

function toStr(v: unknown) {
  return String(v ?? "").trim() || null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, { key: "mes:envios:get", limit: 300, windowMs: 60_000 });
  if (limited) return limited;
  const forbidden = await requirePermission(request, "VER_MES");
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePaginationStrict(searchParams, {
    defaultPageSize: 20,
    maxPageSize: 100,
  });
  const orderId = String(searchParams.get("orderId") ?? "").trim();
  if (!orderId) return new Response("orderId required", { status: 400 });

  const [{ total }] = await mesDb
    .select({ total: sql<number>`count(*)::int` })
    .from(mesShipments)
    .where(eq(mesShipments.orderId, orderId));

  const rows = await mesDb
    .select({
      id: mesShipments.id,
      orderId: mesShipments.orderId,
      origenArea: mesShipments.origenArea,
      origenNombre: mesShipments.origenNombre,
      destinoArea: mesShipments.destinoArea,
      destinoNombre: mesShipments.destinoNombre,
      transporteTipo: mesShipments.transporteTipo,
      transportistaNombre: mesShipments.transportistaNombre,
      empresaTercero: mesShipments.empresaTercero,
      guiaNumero: mesShipments.guiaNumero,
      placa: mesShipments.placa,
      requiereSegundaParada: mesShipments.requiereSegundaParada,
      segundaParadaTipo: mesShipments.segundaParadaTipo,
      segundaParadaDestino: mesShipments.segundaParadaDestino,
      observaciones: mesShipments.observaciones,
      evidenciaUrl: mesShipments.evidenciaUrl,
      status: mesShipments.status,
      salidaAt: mesShipments.salidaAt,
      llegadaAt: mesShipments.llegadaAt,
      retornoAt: mesShipments.retornoAt,
      createdAt: mesShipments.createdAt,
    })
    .from(mesShipments)
    .where(eq(mesShipments.orderId, orderId))
    .orderBy(desc(mesShipments.createdAt))
    .limit(pageSize)
    .offset(offset);

  const envioIds = rows.map((r) => r.id);
  const allItems = envioIds.length
    ? await mesDb
        .select({
          id: mesShipmentItems.id,
          envioId: mesShipmentItems.envioId,
          orderItemId: mesShipmentItems.orderItemId,
          quantity: mesShipmentItems.quantity,
          notes: mesShipmentItems.notes,
        })
        .from(mesShipmentItems)
        .where(inArray(mesShipmentItems.envioId, envioIds))
    : [];

  const orderItemIds = Array.from(
    new Set(allItems.map((row) => String(row.orderItemId ?? "").trim()).filter(Boolean)),
  );
  const orderItemsRows = orderItemIds.length
    ? await erpDb
        .select({ id: orderItems.id, name: orderItems.name })
        .from(orderItems)
        .where(inArray(orderItems.id, orderItemIds))
    : [];
  const orderItemNameById = new Map(orderItemsRows.map((row) => [row.id, row.name]));

  const itemsByEnvio = new Map<string, typeof allItems>();
  for (const item of allItems) {
    const key = String(item.envioId);
    itemsByEnvio.set(key, [
      ...(itemsByEnvio.get(key) ?? []),
      {
        ...item,
        itemName: orderItemNameById.get(String(item.orderItemId)) ?? null,
      } as typeof item,
    ]);
  }

  return Response.json({
    items: rows.map((row) => ({ ...row, items: itemsByEnvio.get(row.id) ?? [] })),
    page,
    pageSize,
    total,
    hasNextPage: offset + rows.length < total,
  });
}

export async function POST(request: Request) {
  const limited = rateLimit(request, { key: "mes:envios:post", limit: 60, windowMs: 60_000 });
  if (limited) return limited;
  const forbidden = await requirePermission(request, "EDITAR_MES");
  if (forbidden) return forbidden;

  const body = await request.json();
  const orderId = toStr(body?.orderId);
  if (!orderId) return new Response("orderId required", { status: 400 });

  const origenArea = String(body?.origenArea ?? "").toUpperCase();
  if (!(mesShipmentAreaValues as readonly string[]).includes(origenArea))
    return new Response("origenArea invalido", { status: 400 });

  const destinoArea = String(body?.destinoArea ?? "").toUpperCase();
  if (!(mesShipmentAreaValues as readonly string[]).includes(destinoArea))
    return new Response("destinoArea invalido", { status: 400 });

  const transporteTipo = String(body?.transporteTipo ?? "").toUpperCase();
  if (!(mesTransportTypeValues as readonly string[]).includes(transporteTipo))
    return new Response("transporteTipo invalido", { status: 400 });

  if (transporteTipo === "LINEA_TERCERO" && !toStr(body?.empresaTercero))
    return new Response("empresaTercero requerida para LINEA_TERCERO", { status: 400 });

  const empleadoId = getEmployeeIdFromRequest(request);
  const itemsRaw: Array<{ orderItemId: string; quantity: number; notes?: string }> =
    Array.isArray(body?.items) ? body.items : [];

  const createdEnvio = await mesDb.transaction(async (tx) => {
    const [envio] = await tx
      .insert(mesShipments)
      .values({
        orderId,
        origenArea: origenArea as any,
        origenNombre: toStr(body?.origenNombre),
        destinoArea: destinoArea as any,
        destinoNombre: toStr(body?.destinoNombre),
        transporteTipo: transporteTipo as any,
        transportistaEmpleadoId: toStr(body?.transportistaEmpleadoId),
        transportistaNombre: toStr(body?.transportistaNombre),
        empresaTercero: toStr(body?.empresaTercero),
        guiaNumero: toStr(body?.guiaNumero),
        placa: toStr(body?.placa),
        requiereSegundaParada: Boolean(body?.requiereSegundaParada),
        segundaParadaTipo: toStr(body?.segundaParadaTipo),
        segundaParadaDestino: toStr(body?.segundaParadaDestino),
        observaciones: toStr(body?.observaciones),
        evidenciaUrl: toStr(body?.evidenciaUrl),
        status: "CREADO",
        salidaAt: body?.salidaAt ? new Date(body.salidaAt) : null,
        createdBy: empleadoId,
      } as any)
      .returning({ id: mesShipments.id });

    if (!envio?.id) throw new Error("No se pudo crear el envio");

    if (itemsRaw.length > 0) {
      await tx.insert(mesShipmentItems).values(
        itemsRaw.map((item) => ({
          envioId: envio.id,
          orderItemId: String(item.orderItemId),
          quantity: Math.max(0, Number(item.quantity) || 0),
          notes: item.notes ? String(item.notes).trim() : null,
        })),
      );
    }
    return envio;
  });

  return Response.json({ id: createdEnvio.id }, { status: 201 });
}
