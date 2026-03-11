import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  employees,
  orderPayments,
  orders,
  prefacturas,
  quotations,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
  getUserIdFromRequest,
} from "@/src/utils/auth-middleware";
import { requirePermission } from "@/src/utils/permission-middleware";
import { isConfirmedPaymentStatus } from "@/src/utils/payment-status";
import { rateLimit } from "@/src/utils/rate-limit";

async function resolveEmployeeId(request: Request) {
  const direct = getEmployeeIdFromRequest(request);

  if (direct) return direct;

  const userId = getUserIdFromRequest(request);

  if (!userId) return null;

  const [row] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1);

  return row?.id ?? null;
}

async function resolveAdvisorFilter(request: Request) {
  const role = getRoleFromRequest(request);

  if (role !== "ASESOR") return null;

  const employeeId = await resolveEmployeeId(request);

  if (!employeeId) return "forbidden";

  return employeeId;
}

function normalizePaymentDocumentType(value: unknown) {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();

  if (raw === "F") return "F";
  if (raw === "R") return "R";
  if (raw === "P") return "F";

  return null;
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "pagos:client-orders:get",
    limit: 200,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PAGO");

  if (forbidden) return forbidden;

  const advisorScope = await resolveAdvisorFilter(request);

  if (advisorScope === "forbidden") {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = String(searchParams.get("clientId") ?? "").trim();

  if (!clientId) {
    return new Response("clientId required", { status: 400 });
  }

  const filters: Array<any> = [
    eq(orders.clientId, clientId),
    advisorScope ? eq(orders.createdBy, advisorScope) : undefined,
  ].filter(Boolean);

  const where = and(...filters);

  const orderRows = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      status: orders.status,
      total: orders.total,
      currency: orders.currency,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt));

  if (orderRows.length === 0) {
    return new Response("No hay pedidos para el cliente seleccionado", {
      status: 404,
    });
  }

  const [clientRow] = await db
    .select({
      id: clients.id,
      clientCode: clients.clientCode,
      name: clients.name,
      identificationType: clients.identificationType,
      identification: clients.identification,
      contactName: clients.contactName,
      email: clients.email,
      address: clients.address,
      city: clients.city,
      department: clients.department,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!clientRow) return new Response("Cliente no encontrado", { status: 404 });

  const orderIds = orderRows.map((row) => row.id);

  const prefacturaRows = await db
    .select({
      orderId: prefacturas.orderId,
      documentType: quotations.documentType,
      prefacturaCode: prefacturas.prefacturaCode,
      createdAt: prefacturas.createdAt,
    })
    .from(prefacturas)
    .leftJoin(quotations, eq(prefacturas.quotationId, quotations.id))
    .where(inArray(prefacturas.orderId, orderIds));

  const prefacturaMap = new Map<
    string,
    {
      documentType: string | null;
      prefacturaCode: string | null;
      createdAt: string | null;
    }
  >();

  for (const row of prefacturaRows) {
    const orderId = String(row.orderId ?? "");

    if (!orderId) continue;

    const current = prefacturaMap.get(orderId);
    const nextDate = row.createdAt
      ? new Date(String(row.createdAt)).getTime()
      : 0;
    const currentDate = current?.createdAt
      ? new Date(String(current.createdAt)).getTime()
      : 0;

    if (!current || nextDate >= currentDate) {
      prefacturaMap.set(orderId, {
        documentType: normalizePaymentDocumentType(row.documentType),
        prefacturaCode: row.prefacturaCode ? String(row.prefacturaCode) : null,
        createdAt: row.createdAt ? String(row.createdAt) : null,
      });
    }
  }

  const payments = await db
    .select({
      orderId: orderPayments.orderId,
      amount: orderPayments.amount,
      status: orderPayments.status,
      createdAt: orderPayments.createdAt,
    })
    .from(orderPayments)
    .where(inArray(orderPayments.orderId, orderIds));

  const paidMap = new Map<string, number>();
  const movementsMap = new Map<string, number>();
  const lastPaymentMap = new Map<string, string | null>();

  for (const payment of payments) {
    const orderId = String(payment.orderId ?? "");

    if (!orderId) continue;

    movementsMap.set(orderId, (movementsMap.get(orderId) ?? 0) + 1);

    const paymentAt = payment.createdAt ? String(payment.createdAt) : null;

    if (paymentAt) {
      const current = lastPaymentMap.get(orderId);

      if (
        !current ||
        new Date(paymentAt).getTime() > new Date(current).getTime()
      ) {
        lastPaymentMap.set(orderId, paymentAt);
      }
    }

    if (!isConfirmedPaymentStatus(payment.status)) continue;

    const amount = Number(payment.amount ?? 0);

    if (!Number.isFinite(amount) || amount <= 0) continue;

    paidMap.set(orderId, (paidMap.get(orderId) ?? 0) + amount);
  }

  const items = orderRows.map((row) => {
    const total = Number(row.total ?? 0);
    const paid = paidMap.get(row.id) ?? 0;
    const remaining = Math.max(0, total - paid);

    return {
      ...row,
      prefacturaDocumentType: prefacturaMap.get(row.id)?.documentType ?? null,
      prefacturaCode: prefacturaMap.get(row.id)?.prefacturaCode ?? null,
      paidTotal: String(Math.max(0, paid)),
      remainingTotal: String(remaining),
      movementsCount: movementsMap.get(row.id) ?? 0,
      lastPaymentAt: lastPaymentMap.get(row.id) ?? null,
    };
  });

  const billedTotal = items.reduce(
    (acc, row) => acc + Number(row.total ?? 0),
    0,
  );
  const dueTotal = items.reduce(
    (acc, row) => acc + Number(row.remainingTotal ?? 0),
    0,
  );

  return Response.json({
    client: clientRow,
    billedTotal: String(Math.max(0, billedTotal)),
    dueTotal: String(Math.max(0, dueTotal)),
    orders: items,
  });
}
