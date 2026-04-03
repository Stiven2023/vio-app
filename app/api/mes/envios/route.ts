/**
 * GET    /api/mes/envios?orderId=<uuid>   - list envios for an order
 * POST   /api/mes/envios                  - create a new envio (with items)
 */
import { desc, eq, inArray, sql } from "drizzle-orm";

import { erpDb, mesDb } from "@/src/db";
import {
  clientLegalStatus,
  orderItems,
  orders,
  preInvoices,
} from "@/src/db/erp/schema";
import { mesItemTags, mesShipmentItems, mesShipments } from "@/src/db/mes/schema";
import { jsonError, jsonForbidden, jsonNotFound, zodFirstErrorEnvelope, dbJsonError } from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { getEmployeeIdFromRequest } from "@/src/utils/auth-middleware";
import {
  getDispatchBlockingRule,
  hasAccountingApproval,
  isDispatchShipment,
  mesEnvioCreateSchema,
  normalizeDispatchApprovals,
} from "@/src/utils/mes-workflow";
import { parsePaginationStrict } from "@/src/utils/pagination";
import { rateLimit } from "@/src/utils/rate-limit";

function toStr(v: unknown) {
  return String(v ?? "").trim() || null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, { key: "mes:envios:get", limit: 300, windowMs: 60_000 });
  if (limited) return limited;
  const forbidden = await requirePermission(request, "VER_MES");
  if (forbidden) return jsonForbidden();

  const { searchParams } = new URL(request.url);
  const { page, pageSize, offset } = parsePaginationStrict(searchParams, {
    defaultPageSize: 20,
    maxPageSize: 100,
  });
  const orderId = String(searchParams.get("orderId") ?? "").trim();
  if (!orderId) {
    return jsonError(400, "VALIDATION_ERROR", "El pedido es obligatorio.", {
      orderId: ["Debes indicar el pedido a consultar."],
    });
  }

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
      dispatchApprovals: mesShipments.dispatchApprovals,
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
  if (forbidden) return jsonForbidden();

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(400, "VALIDATION_ERROR", "El cuerpo de la solicitud no es JSON válido.", {
      body: ["Envía un JSON válido."],
    });
  }

  const parsed = mesEnvioCreateSchema.safeParse(body);

  if (!parsed.success) {
    return zodFirstErrorEnvelope(parsed.error, "Los datos del envío son inválidos.");
  }

  const payload = parsed.data;
  const orderId = payload.orderId;
  const origenArea = payload.origenArea;
  const destinoArea = payload.destinoArea;
  const transporteTipo = payload.transporteTipo;

  const empleadoId = getEmployeeIdFromRequest(request);
  const itemsRaw = payload.items.map((item) => ({
    orderItemId: String(item.orderItemId).trim(),
    quantity: Math.max(0, Number(item.quantity) || 0),
    notes: toStr(item.notes),
  }));

  try {
    const [orderRow] = await erpDb
      .select({ id: orders.id, clientId: orders.clientId, orderCode: orders.orderCode })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!orderRow) {
      return jsonNotFound("El pedido indicado no existe.");
    }

    const itemIds = itemsRaw.map((item) => item.orderItemId);
    const orderItemsRows = itemIds.length
      ? await erpDb
          .select({ id: orderItems.id, orderId: orderItems.orderId })
          .from(orderItems)
          .where(inArray(orderItems.id, itemIds))
      : [];

    const validItemIds = new Set(
      orderItemsRows
        .filter((item) => String(item.orderId ?? "") === orderId)
        .map((item) => String(item.id ?? "").trim()),
    );

    if (validItemIds.size !== itemIds.length) {
      return jsonError(
        422,
        "INVALID_ORDER_ITEMS",
        "Uno o más diseños no pertenecen al pedido seleccionado.",
        {
          items: ["Verifica los diseños incluidos en el envío."],
        },
      );
    }

    if (isDispatchShipment({ origenArea, destinoArea })) {
      const [prefacturaRow] = await erpDb
        .select({
          accountingStatus: preInvoices.status,
          advanceReceived: preInvoices.advanceReceived,
          advanceStatus: preInvoices.advanceStatus,
        })
        .from(preInvoices)
        .where(eq(preInvoices.orderId, orderId))
        .limit(1);

      const [legalStatusRow] = orderRow.clientId
        ? await erpDb
            .select({ isLegallyEnabled: clientLegalStatus.isLegallyEnabled })
            .from(clientLegalStatus)
            .where(eq(clientLegalStatus.clientId, orderRow.clientId))
            .limit(1)
        : [];

      const [{ totalItems }] = await erpDb
        .select({ totalItems: sql<number>`count(*)::int` })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

      const isPartialDispatch = Number(totalItems ?? 0) > itemIds.length;
      const partialApprovalRows = isPartialDispatch
        ? await mesDb
            .select({ id: mesItemTags.id })
            .from(mesItemTags)
            .where(
              sql`${mesItemTags.orderId} = ${orderId} and ${mesItemTags.tag} = 'DESPACHO_PARCIAL' and ${mesItemTags.orderItemId} in ${itemIds}`,
            )
            .limit(1)
        : [];

      const dispatchApprovals = normalizeDispatchApprovals(
        payload.dispatchApprovals,
      );

      const blockingRule = getDispatchBlockingRule({
        legalEnabled: legalStatusRow?.isLegallyEnabled ?? true,
        sellerApproved: Boolean(dispatchApprovals?.seller.approved),
        carteraApproved: Boolean(dispatchApprovals?.cartera.approved),
        accountingApproved:
          hasAccountingApproval({
            accountingStatus: prefacturaRow?.accountingStatus ?? null,
            advanceReceived: prefacturaRow?.advanceReceived ?? null,
            advanceStatus: prefacturaRow?.advanceStatus ?? null,
          }) && Boolean(dispatchApprovals?.accounting.approved),
        isPartialDispatch,
        partialDispatchApproved:
          partialApprovalRows.length > 0 ||
          !isPartialDispatch ||
          Boolean(dispatchApprovals?.partial?.approved),
      });

      if (blockingRule) {
        return jsonError(
          blockingRule.status,
          blockingRule.code,
          blockingRule.message,
          blockingRule.fieldErrors,
        );
      }
    }

    const createdEnvio = await mesDb.transaction(async (tx) => {
      const [envio] = await tx
        .insert(mesShipments)
        .values({
          orderId,
          origenArea: origenArea as any,
          origenNombre: toStr(payload.origenNombre),
          destinoArea: destinoArea as any,
          destinoNombre: toStr(payload.destinoNombre),
          transporteTipo: transporteTipo as any,
          transportistaEmpleadoId: toStr(payload.transportistaEmpleadoId),
          transportistaNombre: toStr(payload.transportistaNombre),
          empresaTercero: toStr(payload.empresaTercero),
          guiaNumero: toStr(payload.guiaNumero),
          placa: toStr(payload.placa),
          requiereSegundaParada: Boolean(payload.requiereSegundaParada),
          segundaParadaTipo: toStr(payload.segundaParadaTipo),
          segundaParadaDestino: toStr(payload.segundaParadaDestino),
          observaciones: toStr(payload.observaciones),
          evidenciaUrl: toStr(payload.evidenciaUrl),
          dispatchApprovals: normalizeDispatchApprovals(payload.dispatchApprovals),
          status: "CREADO",
          salidaAt: payload.salidaAt ? new Date(payload.salidaAt) : null,
          createdBy: empleadoId,
        } as any)
        .returning({ id: mesShipments.id });

      if (!envio?.id) throw new Error("No se pudo crear el envío");

      await tx.insert(mesShipmentItems).values(
        itemsRaw.map((item) => ({
          envioId: envio.id,
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          notes: item.notes,
        })),
      );

      return envio;
    });

    return Response.json({ id: createdEnvio.id }, { status: 201 });
  } catch (error) {
    const resp = dbJsonError(error, "No se pudo registrar el envío.");

    if (resp) return resp;

    return jsonError(500, "INTERNAL_ERROR", "No se pudo registrar el envío.");
  }
}
