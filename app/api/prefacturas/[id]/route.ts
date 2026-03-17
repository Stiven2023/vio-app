import { and, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  orderPayments,
  orders,
  orderStatusHistory,
  prefacturas,
  quotations,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
} from "@/src/utils/auth-middleware";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { isConfirmedPaymentStatus } from "@/src/utils/payment-status";
import {
  resolvePaymentBankById,
  validatePaymentBankCurrency,
} from "@/src/utils/payment-banks";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

const ADVANCE_PAYMENT_METHODS = new Set(["EFECTIVO", "TRANSFERENCIA"]);

function toNullableNumericValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value));

  if (!Number.isFinite(n)) return null;

  return n;
}

function normalizeCurrency(value: unknown) {
  return String(value ?? "COP").trim().toUpperCase() === "USD" ? "USD" : "COP";
}

async function syncOrderStatusByPaymentsTx(tx: any, orderId: string) {
  const [orderRow] = await tx
    .select({ id: orders.id, total: orders.total, status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderRow) return;

  const paidRows = await tx
    .select({ amount: orderPayments.amount, status: orderPayments.status })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId));

  const total = Math.max(0, Number(orderRow.total ?? 0));
  const paidTotal = Math.max(
    0,
    paidRows.reduce((acc: number, row: any) => {
      if (!isConfirmedPaymentStatus(row.status)) return acc;
      const amount = Number(row.amount ?? 0);
      return acc + (Number.isFinite(amount) ? amount : 0);
    }, 0),
  );
  const paidPercent = total > 0 ? (paidTotal / total) * 100 : 0;

  const nextOrderStatus =
    paidPercent >= 50
      ? "PROGRAMACION"
      : paidTotal > 0
        ? "APROBACION"
        : "PENDIENTE";

  const nextPrefacturaStatus =
    paidPercent >= 50
      ? "PROGRAMACION"
      : paidTotal > 0
        ? "APROBACION"
        : "PENDIENTE_CONTABILIDAD";

  const [currentOrder] = await tx
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (String(currentOrder?.status ?? "") !== nextOrderStatus) {
    await tx
      .update(orders)
      .set({ status: nextOrderStatus as any })
      .where(eq(orders.id, orderId));

    await tx.insert(orderStatusHistory).values({
      orderId,
      status: nextOrderStatus as any,
      changedBy: null,
    });
  }

  await tx
    .update(prefacturas)
    .set({ status: nextPrefacturaStatus })
    .where(eq(prefacturas.orderId, orderId));
}

function isMissingColumnError(error: unknown) {
  let current: any = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== "object") break;

    const code = String(current.code ?? "");
    const message = String(current.message ?? "").toLowerCase();

    if (
      code === "42703" ||
      message.includes("undefined_column") ||
      message.includes("does not exist")
    ) {
      return true;
    }

    current = current.cause ?? current.error ?? null;
  }

  return false;
}

function readMissingColumnName(error: unknown): string | null {
  let current: any = error;

  for (let depth = 0; depth < 5; depth += 1) {
    if (!current || typeof current !== "object") break;

    const message = String(current.message ?? "");
    const quotedMatch = message.match(/column\s+"([^"]+)"/i);

    if (quotedMatch?.[1]) return quotedMatch[1].toLowerCase();

    const bareMatch = message.match(/column\s+([a-zA-Z0-9_]+)\s+/i);

    if (bareMatch?.[1]) return bareMatch[1].toLowerCase();

    current = current.cause ?? current.error ?? null;
  }

  return null;
}

const PREFAC_PATCH_COLUMN_TO_KEY: Record<string, string> = {
  advance_bank_id: "advanceBankId",
  advance_reference_number: "advanceReferenceNumber",
  advance_currency: "advanceCurrency",
  advance_payment_image_url: "advancePaymentImageUrl",
  client_approval_image_url: "clientApprovalImageUrl",
  convenio_image_url: "convenioImageUrl",
};

async function applyPrefacturaPatchWithFallback(
  tx: any,
  prefacturaId: string,
  originalPatch: Record<string, unknown>,
) {
  const patchToApply = { ...originalPatch };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (Object.keys(patchToApply).length === 0) return;

    try {
      await tx
        .update(prefacturas)
        .set(patchToApply as any)
        .where(eq(prefacturas.id, prefacturaId));

      return;
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;

      const missingColumn = readMissingColumnName(error);
      const patchKey = missingColumn
        ? PREFAC_PATCH_COLUMN_TO_KEY[missingColumn]
        : null;

      if (!patchKey || !(patchKey in patchToApply)) {
        throw error;
      }

      delete patchToApply[patchKey];
    }
  }

  throw new Error("prefactura_patch_fallback_exhausted");
}

async function resolveAdvisorFilter(request: Request) {
  const role = getRoleFromRequest(request);

  if (role !== "ASESOR") return null;

  const employeeId = getEmployeeIdFromRequest(request);

  if (!employeeId) return "forbidden";

  return employeeId;
}

async function getPrefacturaById(id: string, advisorScope: string | null) {
  const filters = [eq(prefacturas.id, id)] as Array<any>;

  if (advisorScope) {
    filters.push(eq(orders.createdBy, advisorScope));
  }

  try {
    const [row] = await db
      .select({
        id: prefacturas.id,
        prefacturaCode: prefacturas.prefacturaCode,
        quotationId: prefacturas.quotationId,
        quoteCode: quotations.quoteCode,
        orderId: prefacturas.orderId,
        orderCode: orders.orderCode,
        orderName: orders.orderName,
        orderType: orders.type,
        currency: sql<
          string | null
        >`coalesce(${orders.currency}, ${quotations.currency}, 'COP')`,
        status: prefacturas.status,
        totalProducts: prefacturas.totalProducts,
        subtotal: prefacturas.subtotal,
        total: prefacturas.total,
        clientName: sql<
          string | null
        >`coalesce(${clients.name}, (select c2.name from clients c2 where c2.id = ${quotations.clientId}))`,
        approvedAt: prefacturas.approvedAt,
        createdAt: prefacturas.createdAt,
        advanceRequired: prefacturas.advanceRequired,
        advanceReceived: prefacturas.advanceReceived,
        advanceMethod: prefacturas.advanceMethod,
        advanceBankId: prefacturas.advanceBankId,
        advanceReferenceNumber: prefacturas.advanceReferenceNumber,
        advanceCurrency: prefacturas.advanceCurrency,
        advanceStatus: prefacturas.advanceStatus,
        advanceDate: prefacturas.advanceDate,
        advancePaymentImageUrl: prefacturas.advancePaymentImageUrl,
        hasConvenio: prefacturas.hasConvenio,
        convenioType: prefacturas.convenioType,
        convenioNotes: prefacturas.convenioNotes,
        convenioExpiresAt: prefacturas.convenioExpiresAt,
        hasClientApproval: prefacturas.hasClientApproval,
        clientApprovalDate: prefacturas.clientApprovalDate,
        clientApprovalBy: prefacturas.clientApprovalBy,
        clientApprovalNotes: prefacturas.clientApprovalNotes,
        clientApprovalImageUrl: prefacturas.clientApprovalImageUrl,
        convenioImageUrl: prefacturas.convenioImageUrl,
        // Client details (resolved from order or quotation client)
        clientId: sql<
          string | null
        >`coalesce(${orders.clientId}::text, ${quotations.clientId}::text)`,
        clientCode: sql<
          string | null
        >`coalesce(${clients.clientCode}, (select c2.client_code from clients c2 where c2.id = ${quotations.clientId}))`,
        clientIdentification: sql<
          string | null
        >`coalesce(${clients.identification}, (select c2.identification from clients c2 where c2.id = ${quotations.clientId}))`,
        clientDv: sql<
          string | null
        >`coalesce(${clients.dv}, (select c2.dv from clients c2 where c2.id = ${quotations.clientId}))`,
        clientEmail: sql<
          string | null
        >`coalesce(${clients.email}, (select c2.email from clients c2 where c2.id = ${quotations.clientId}))`,
        clientContactName: sql<
          string | null
        >`coalesce(${clients.contactName}, (select c2.contact_name from clients c2 where c2.id = ${quotations.clientId}))`,
        clientContactPhone: sql<
          string | null
        >`coalesce(${clients.mobile}, (select c2.mobile from clients c2 where c2.id = ${quotations.clientId}))`,
        clientAddress: sql<
          string | null
        >`coalesce(${clients.address}, (select c2.address from clients c2 where c2.id = ${quotations.clientId}))`,
        clientCountry: sql<
          string | null
        >`coalesce(${clients.country}, (select c2.country from clients c2 where c2.id = ${quotations.clientId}))`,
        clientCity: sql<
          string | null
        >`coalesce(${clients.city}, (select c2.city from clients c2 where c2.id = ${quotations.clientId}))`,
        clientPostalCode: sql<
          string | null
        >`coalesce(${clients.postalCode}, (select c2.postal_code from clients c2 where c2.id = ${quotations.clientId}))`,
      })
      .from(prefacturas)
      .leftJoin(quotations, eq(prefacturas.quotationId, quotations.id))
      .leftJoin(orders, eq(prefacturas.orderId, orders.id))
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .where(and(...filters))
      .limit(1);

    return row ?? null;
  } catch {
    const [legacyRow] = await db
      .select({
        id: prefacturas.id,
        prefacturaCode: prefacturas.prefacturaCode,
        quotationId: prefacturas.quotationId,
        quoteCode: quotations.quoteCode,
        orderId: prefacturas.orderId,
        orderCode: orders.orderCode,
        orderName: orders.orderName,
        orderType: orders.type,
        currency: sql<
          string | null
        >`coalesce(${orders.currency}, ${quotations.currency}, 'COP')`,
        status: prefacturas.status,
        totalProducts: prefacturas.totalProducts,
        subtotal: prefacturas.subtotal,
        total: prefacturas.total,
        clientName: sql<
          string | null
        >`coalesce(${clients.name}, (select c2.name from clients c2 where c2.id = ${quotations.clientId}))`,
        approvedAt: prefacturas.approvedAt,
        createdAt: prefacturas.createdAt,
        advanceRequired: prefacturas.advanceRequired,
        advanceReceived: prefacturas.advanceReceived,
        advanceMethod: prefacturas.advanceMethod,
        advanceStatus: prefacturas.advanceStatus,
        advanceDate: prefacturas.advanceDate,
        advancePaymentImageUrl: prefacturas.advancePaymentImageUrl,
        hasConvenio: prefacturas.hasConvenio,
        convenioType: prefacturas.convenioType,
        convenioNotes: prefacturas.convenioNotes,
        convenioExpiresAt: prefacturas.convenioExpiresAt,
        hasClientApproval: prefacturas.hasClientApproval,
        clientApprovalDate: prefacturas.clientApprovalDate,
        clientApprovalBy: prefacturas.clientApprovalBy,
        clientApprovalNotes: prefacturas.clientApprovalNotes,
        clientApprovalImageUrl: prefacturas.clientApprovalImageUrl,
        convenioImageUrl: prefacturas.convenioImageUrl,
        clientId: sql<
          string | null
        >`coalesce(${orders.clientId}::text, ${quotations.clientId}::text)`,
        clientCode: sql<
          string | null
        >`coalesce(${clients.clientCode}, (select c2.client_code from clients c2 where c2.id = ${quotations.clientId}))`,
        clientIdentification: sql<
          string | null
        >`coalesce(${clients.identification}, (select c2.identification from clients c2 where c2.id = ${quotations.clientId}))`,
        clientDv: sql<
          string | null
        >`coalesce(${clients.dv}, (select c2.dv from clients c2 where c2.id = ${quotations.clientId}))`,
        clientEmail: sql<
          string | null
        >`coalesce(${clients.email}, (select c2.email from clients c2 where c2.id = ${quotations.clientId}))`,
        clientContactName: sql<
          string | null
        >`coalesce(${clients.contactName}, (select c2.contact_name from clients c2 where c2.id = ${quotations.clientId}))`,
        clientContactPhone: sql<
          string | null
        >`coalesce(${clients.mobile}, (select c2.mobile from clients c2 where c2.id = ${quotations.clientId}))`,
        clientAddress: sql<
          string | null
        >`coalesce(${clients.address}, (select c2.address from clients c2 where c2.id = ${quotations.clientId}))`,
        clientCountry: sql<
          string | null
        >`coalesce(${clients.country}, (select c2.country from clients c2 where c2.id = ${quotations.clientId}))`,
        clientCity: sql<
          string | null
        >`coalesce(${clients.city}, (select c2.city from clients c2 where c2.id = ${quotations.clientId}))`,
        clientPostalCode: sql<
          string | null
        >`coalesce(${clients.postalCode}, (select c2.postal_code from clients c2 where c2.id = ${quotations.clientId}))`,
      })
      .from(prefacturas)
      .leftJoin(quotations, eq(prefacturas.quotationId, quotations.id))
      .leftJoin(orders, eq(prefacturas.orderId, orders.id))
      .leftJoin(clients, eq(orders.clientId, clients.id))
      .where(and(...filters))
      .limit(1);

    return legacyRow ?? null;
  }
}

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "prefacturas:get:id",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const advisorScope = await resolveAdvisorFilter(request);

  if (advisorScope === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }

  const prefacturaId = String(params.id ?? "").trim();

  if (!prefacturaId) return new Response("id required", { status: 400 });

  try {
    const row = await getPrefacturaById(prefacturaId, advisorScope);

    if (!row) {
      return new Response("Prefactura no encontrada", { status: 404 });
    }

    return Response.json(row);
  } catch (error) {
    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo consultar la prefactura", { status: 500 });
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "prefacturas:put:id",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const advisorScope = await resolveAdvisorFilter(request);

  if (advisorScope === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }

  const prefacturaId = String(params.id ?? "").trim();

  if (!prefacturaId) return new Response("id required", { status: 400 });

  try {
    const body = await request.json();
    const orderName = String(body?.orderName ?? "").trim();
    const orderType = String(body?.orderType ?? "")
      .trim()
      .toUpperCase();
    const status = String(body?.status ?? "")
      .trim()
      .toUpperCase();
    const currency =
      String(body?.currency ?? "COP")
        .trim()
        .toUpperCase() === "USD"
        ? "USD"
        : "COP";

    const updated = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: prefacturas.id,
          quotationId: prefacturas.quotationId,
          orderId: prefacturas.orderId,
          orderCreatedBy: orders.createdBy,
          orderStatus: orders.status,
        })
        .from(prefacturas)
        .leftJoin(orders, eq(prefacturas.orderId, orders.id))
        .where(eq(prefacturas.id, prefacturaId))
        .limit(1);

      if (!current) return null;

      if (advisorScope && current.orderCreatedBy !== advisorScope) {
        throw new Error("forbidden");
      }

      const ORDER_MONTAJE_LOCKED_STATUSES = new Set<string>([
        "PRODUCCION",
        "ATRASADO",
        "FINALIZADO",
        "ENTREGADO",
      ]);

      if (ORDER_MONTAJE_LOCKED_STATUSES.has(String(current.orderStatus ?? ""))) {
        throw new Error("prefactura_locked_by_production");
      }

      if (status) {
        await tx
          .update(prefacturas)
          .set({ status })
          .where(eq(prefacturas.id, prefacturaId));

        if (current.quotationId) {
          await tx
            .update(quotations)
            .set({
              prefacturaApproved: status === "APROBADA",
              updatedAt: new Date(),
            })
            .where(eq(quotations.id, String(current.quotationId)));
        }
      }

      if (
        current.orderId &&
        (orderName ||
          orderType === "VN" ||
          orderType === "VI" ||
          orderType === "VT" ||
          orderType === "VW" ||
          "currency" in body)
      ) {
        await tx
          .update(orders)
          .set({
            orderName: orderName || undefined,
            type:
              orderType === "VI" || orderType === "VT" || orderType === "VW"
                ? (orderType as any)
                : orderType === "VN"
                  ? ("VN" as any)
                  : undefined,
            currency: "currency" in body ? currency : undefined,
          })
          .where(eq(orders.id, String(current.orderId)));
      }

      return current;
    });

    if (!updated) {
      return new Response("Prefactura no encontrada", { status: 404 });
    }

    try {
      const row = await getPrefacturaById(prefacturaId, advisorScope || null);

      if (!row) {
        return Response.json({ ok: true, id: prefacturaId });
      }

      return Response.json(row);
    } catch {
      // Do not fail PUT after successful update if readback has legacy column mismatch.
      return Response.json({ ok: true, id: prefacturaId });
    }
  } catch (error) {
    if ((error as Error)?.message === "forbidden") {
      return new Response("Forbidden", { status: 403 });
    }

    if ((error as Error)?.message === "prefactura_locked_by_production") {
      return new Response(
        "No se puede modificar la prefactura: el pedido está en montaje o superior. Solo está permitido consultar y registrar abonos.",
        { status: 422 },
      );
    }

    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo actualizar la prefactura", { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "prefacturas:patch:id",
    limit: 120,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "EDITAR_PEDIDO");

  if (forbidden) return forbidden;

  const advisorScope = await resolveAdvisorFilter(request);

  if (advisorScope === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }

  const prefacturaId = String(params.id ?? "").trim();

  if (!prefacturaId) return new Response("id required", { status: 400 });

  try {
    const body = await request.json();

    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: prefacturas.id,
          orderId: prefacturas.orderId,
          orderCreatedBy: orders.createdBy,
          advanceReceived: prefacturas.advanceReceived,
          advanceMethod: prefacturas.advanceMethod,
          advanceBankId: prefacturas.advanceBankId,
          advanceReferenceNumber: prefacturas.advanceReferenceNumber,
          advanceCurrency: prefacturas.advanceCurrency,
          advancePaymentImageUrl: prefacturas.advancePaymentImageUrl,
        })
        .from(prefacturas)
        .leftJoin(orders, eq(prefacturas.orderId, orders.id))
        .where(eq(prefacturas.id, prefacturaId))
        .limit(1);

      if (!current) throw new Error("not_found");
      if (advisorScope && current.orderCreatedBy !== advisorScope) {
        throw new Error("forbidden");
      }

      const patch: Record<string, unknown> = {};

      // Anticipo
      if ("advanceRequired" in body) {
        const v = Number(body.advanceRequired);

        patch.advanceRequired = Number.isFinite(v) && v >= 0 ? String(v) : "0";
      }
      if ("advanceReceived" in body) {
        const v = Number(body.advanceReceived);

        patch.advanceReceived = Number.isFinite(v) && v >= 0 ? String(v) : "0";
      }
      if ("advanceMethod" in body) {
        const m = String(body.advanceMethod ?? "").toUpperCase();

        patch.advanceMethod =
          m === "EFECTIVO" || m === "TRANSFERENCIA" ? m : null;
      }
      if ("advanceBankId" in body) {
        patch.advanceBankId = body.advanceBankId
          ? String(body.advanceBankId)
          : null;
      }
      if ("advanceReferenceNumber" in body) {
        patch.advanceReferenceNumber = body.advanceReferenceNumber
          ? String(body.advanceReferenceNumber).slice(0, 120)
          : null;
      }
      if ("advanceCurrency" in body) {
        patch.advanceCurrency =
          String(body.advanceCurrency ?? "COP")
            .trim()
            .toUpperCase() === "USD"
            ? "USD"
            : "COP";
      }
      if ("advanceStatus" in body) {
        const s = String(body.advanceStatus ?? "").toUpperCase();

        if (["PENDIENTE", "PARCIAL", "RECIBIDO"].includes(s)) {
          patch.advanceStatus = s;
        }
      }
      if ("advanceDate" in body) {
        patch.advanceDate = body.advanceDate
          ? new Date(body.advanceDate)
          : null;
      }
      if ("advancePaymentImageUrl" in body) {
        patch.advancePaymentImageUrl = body.advancePaymentImageUrl
          ? String(body.advancePaymentImageUrl)
          : null;
      }

      // Convenio
      if ("hasConvenio" in body) {
        patch.hasConvenio = Boolean(body.hasConvenio);
      }
      if ("convenioType" in body) {
        patch.convenioType = body.convenioType
          ? String(body.convenioType).slice(0, 80)
          : null;
      }
      if ("convenioNotes" in body) {
        patch.convenioNotes = body.convenioNotes
          ? String(body.convenioNotes)
          : null;
      }
      if ("convenioExpiresAt" in body) {
        patch.convenioExpiresAt = body.convenioExpiresAt
          ? String(body.convenioExpiresAt)
          : null;
      }

      // Client approval / aval del cliente
      if ("hasClientApproval" in body) {
        patch.hasClientApproval = Boolean(body.hasClientApproval);
      }
      if ("clientApprovalDate" in body) {
        patch.clientApprovalDate = body.clientApprovalDate
          ? String(body.clientApprovalDate)
          : null;
      }
      if ("clientApprovalBy" in body) {
        patch.clientApprovalBy = body.clientApprovalBy
          ? String(body.clientApprovalBy).slice(0, 150)
          : null;
      }
      if ("clientApprovalNotes" in body) {
        patch.clientApprovalNotes = body.clientApprovalNotes
          ? String(body.clientApprovalNotes)
          : null;
      }
      if ("clientApprovalImageUrl" in body) {
        patch.clientApprovalImageUrl = body.clientApprovalImageUrl
          ? String(body.clientApprovalImageUrl)
          : null;
      }
      if ("convenioImageUrl" in body) {
        patch.convenioImageUrl = body.convenioImageUrl
          ? String(body.convenioImageUrl)
          : null;
      }

      if (Object.keys(patch).length === 0) return;

      const previousAdvanceReceived = Math.max(
        0,
        toNullableNumericValue(current.advanceReceived) ?? 0,
      );
      const nextAdvanceReceived = Math.max(
        0,
        toNullableNumericValue(
          patch.advanceReceived ?? current.advanceReceived,
        ) ?? 0,
      );
      const registeredAdvanceDelta = Math.max(
        0,
        nextAdvanceReceived - previousAdvanceReceived,
      );

      await applyPrefacturaPatchWithFallback(tx, prefacturaId, patch);

      if (current.orderId && registeredAdvanceDelta > 0) {
        const effectiveMethod = String(
          patch.advanceMethod ?? current.advanceMethod ?? "",
        ).toUpperCase();

        if (ADVANCE_PAYMENT_METHODS.has(effectiveMethod)) {
          const effectiveBankId =
            patch.advanceBankId !== undefined
              ? String(patch.advanceBankId ?? "").trim() || null
              : current.advanceBankId
                ? String(current.advanceBankId)
                : null;
          const effectiveReference =
            patch.advanceReferenceNumber !== undefined
              ? String(patch.advanceReferenceNumber ?? "").trim() || null
              : current.advanceReferenceNumber
                ? String(current.advanceReferenceNumber)
                : null;
          const effectiveCurrency = normalizeCurrency(
            patch.advanceCurrency ?? current.advanceCurrency,
          );
          const effectiveProofImageUrl =
            patch.advancePaymentImageUrl !== undefined
              ? String(patch.advancePaymentImageUrl ?? "").trim() || null
              : current.advancePaymentImageUrl
                ? String(current.advancePaymentImageUrl)
                : null;

          const bankRow =
            effectiveMethod === "TRANSFERENCIA" && effectiveBankId
              ? await resolvePaymentBankById(db, effectiveBankId)
              : null;

          if (effectiveMethod === "TRANSFERENCIA") {
            const bankValidationError = validatePaymentBankCurrency(
              bankRow,
              effectiveCurrency,
            );

            if (bankValidationError) {
              throw new Error(`bad_request:${bankValidationError}`);
            }
          }

          const paymentStatus =
            effectiveMethod === "EFECTIVO" ? "CONFIRMADO_CAJA" : "PENDIENTE";

          await tx.insert(orderPayments).values({
            orderId: String(current.orderId),
            amount: String(registeredAdvanceDelta),
            depositAmount: String(registeredAdvanceDelta),
            referenceCode: effectiveReference,
            method: effectiveMethod as any,
            bankId:
              effectiveMethod === "TRANSFERENCIA" ? bankRow?.id ?? null : null,
            transferBank: null,
            transferCurrency:
              effectiveMethod === "TRANSFERENCIA" ? effectiveCurrency : null,
            status: paymentStatus as any,
            proofImageUrl: effectiveProofImageUrl,
          } as any);
        }
      }

      const shouldSyncByAdvance =
        "advanceReceived" in body ||
        "advanceStatus" in body ||
        registeredAdvanceDelta > 0;

      if (shouldSyncByAdvance && current.orderId) {
        await syncOrderStatusByPaymentsTx(tx, String(current.orderId));
      }
    });

    return Response.json({ ok: true });
  } catch (error) {
    if ((error as Error)?.message?.startsWith("bad_request:")) {
      return new Response((error as Error).message.replace("bad_request:", ""), {
        status: 400,
      });
    }

    if ((error as Error)?.message === "forbidden") {
      return new Response("Forbidden", { status: 403 });
    }
    if ((error as Error)?.message === "not_found") {
      return new Response("Prefactura no encontrada", { status: 404 });
    }

    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo actualizar la prefactura", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;

  const limited = rateLimit(request, {
    key: "prefacturas:delete:id",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "ELIMINAR_PEDIDO");

  if (forbidden) return forbidden;

  const advisorScope = await resolveAdvisorFilter(request);

  if (advisorScope === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }

  const prefacturaId = String(params.id ?? "").trim();

  if (!prefacturaId) return new Response("id required", { status: 400 });

  try {
    const deleted = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          id: prefacturas.id,
          quotationId: prefacturas.quotationId,
          orderCreatedBy: orders.createdBy,
        })
        .from(prefacturas)
        .leftJoin(orders, eq(prefacturas.orderId, orders.id))
        .where(eq(prefacturas.id, prefacturaId))
        .limit(1);

      if (!current) return null;

      if (advisorScope && current.orderCreatedBy !== advisorScope) {
        throw new Error("forbidden");
      }

      await tx.delete(prefacturas).where(eq(prefacturas.id, prefacturaId));

      if (current.quotationId) {
        await tx
          .update(quotations)
          .set({ prefacturaApproved: false, updatedAt: new Date() })
          .where(eq(quotations.id, String(current.quotationId)));
      }

      return current;
    });

    if (!deleted) {
      return new Response("Prefactura no encontrada", { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    if ((error as Error)?.message === "forbidden") {
      return new Response("Forbidden", { status: 403 });
    }

    const response = dbErrorResponse(error);

    if (response) return response;

    return new Response("No se pudo eliminar la prefactura", { status: 500 });
  }
}
