/**
 * GET    /api/mes/envios?orderId=<uuid>   - list envios for an order
 * POST   /api/mes/envios                  - create a new envio (with items)
 */
import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import { mesEnvios, mesEnvioItems, orderItems } from "@/src/db/schema";
import {
  mesShipmentAreaValues,
  mesTransportTypeValues,
} from "@/src/db/enums";
import { requirePermission } from "@/src/utils/permission-middleware";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
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
  const orderId = String(searchParams.get("orderId") ?? "").trim();
  if (!orderId) return new Response("orderId required", { status: 400 });

  const rows = await db
    .select({
      id: mesEnvios.id,
      orderId: mesEnvios.orderId,
      origenArea: mesEnvios.origenArea,
      origenNombre: mesEnvios.origenNombre,
      destinoArea: mesEnvios.destinoArea,
      destinoNombre: mesEnvios.destinoNombre,
      transporteTipo: mesEnvios.transporteTipo,
      transportistaNombre: mesEnvios.transportistaNombre,
      empresaTercero: mesEnvios.empresaTercero,
      guiaNumero: mesEnvios.guiaNumero,
      placa: mesEnvios.placa,
      requiereSegundaParada: mesEnvios.requiereSegundaParada,
      segundaParadaTipo: mesEnvios.segundaParadaTipo,
      segundaParadaDestino: mesEnvios.segundaParadaDestino,
      observaciones: mesEnvios.observaciones,
      evidenciaUrl: mesEnvios.evidenciaUrl,
      status: mesEnvios.status,
      salidaAt: mesEnvios.salidaAt,
      llegadaAt: mesEnvios.llegadaAt,
      retornoAt: mesEnvios.retornoAt,
      createdAt: mesEnvios.createdAt,
    })
    .from(mesEnvios)
    .where(eq(mesEnvios.orderId, orderId))
    .orderBy(desc(mesEnvios.createdAt));

  const envioIds = rows.map((r) => r.id);
  const allItems = envioIds.length
    ? await db
        .select({
          id: mesEnvioItems.id,
          envioId: mesEnvioItems.envioId,
          orderItemId: mesEnvioItems.orderItemId,
          quantity: mesEnvioItems.quantity,
          notes: mesEnvioItems.notes,
          itemName: orderItems.name,
        })
        .from(mesEnvioItems)
        .leftJoin(orderItems, eq(mesEnvioItems.orderItemId, orderItems.id))
        .where(inArray(mesEnvioItems.envioId, envioIds))
    : [];

  const itemsByEnvio = new Map<string, typeof allItems>();
  for (const item of allItems) {
    const key = String(item.envioId);
    itemsByEnvio.set(key, [...(itemsByEnvio.get(key) ?? []), item]);
  }

  return Response.json({
    items: rows.map((row) => ({ ...row, items: itemsByEnvio.get(row.id) ?? [] })),
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

  const createdEnvio = await db.transaction(async (tx) => {
    const [envio] = await tx
      .insert(mesEnvios)
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
      .returning({ id: mesEnvios.id });

    if (!envio?.id) throw new Error("No se pudo crear el envio");

    if (itemsRaw.length > 0) {
      await tx.insert(mesEnvioItems).values(
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
