import ExcelJS from "exceljs";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  advisorCommissionRates,
  banks,
  clients,
  employees,
  exchangeRates,
  orderPayments,
  orders,
  prefacturas,
  quotations,
} from "@/src/db/schema";
import { workbookToXlsxResponse } from "@/src/utils/exceljs-export";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

const CONFIRMED_PAYMENT_STATUSES = new Set(["PAGADO", "CONFIRMADO_CAJA"]);

type MacroOrderRow = {
  id: string;
  orderCode: string;
  createdAt: Date | null;
  status: string | null;
  currency: string | null;
  total: string | null;
  shippingFee: string | null;
  clientName: string | null;
  advisorName: string | null;
  deliveryDate: Date | string | null;
};

type MacroPaymentRow = {
  id: string;
  orderId: string | null;
  orderCode: string | null;
  bankCode: string | null;
  bankName: string | null;
  referenceCode: string | null;
  transferCurrency: string | null;
  depositAmount: string | null;
  amount: string | null;
  status: string | null;
  createdAt: Date | null;
};

type ExchangeRateTimelinePoint = {
  atMs: number;
  rate: number;
};

function parseDateParam(value: string, isEnd = false) {
  const input = String(value ?? "").trim();

  if (!input) return null;
  const parsed = new Date(input);

  if (Number.isNaN(parsed.getTime())) return null;
  if (isEnd) parsed.setHours(23, 59, 59, 999);
  if (!isEnd) parsed.setHours(0, 0, 0, 0);

  return parsed;
}

function asNumber(value: unknown) {
  const n = Number(value ?? 0);

  return Number.isFinite(n) ? n : 0;
}

function normalizeCurrency(value: unknown) {
  return String(value ?? "COP")
    .trim()
    .toUpperCase() === "USD"
    ? "USD"
    : "COP";
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(d.getTime())) return "";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");

  return `${day}/${month}/${d.getFullYear()}`;
}

function getIsoWeek(value: Date | string | null | undefined) {
  if (!value) return "";
  const d = value instanceof Date ? new Date(value) : new Date(String(value));

  if (Number.isNaN(d.getTime())) return "";

  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);

  return String(
    1 +
      Math.round(
        ((d.getTime() - week1.getTime()) / 86_400_000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7,
      ),
  );
}

function parseAdvisorRates(raw: string | null) {
  const map = new Map<string, number>();
  const source = String(raw ?? "").trim();

  if (!source) return map;

  for (const chunk of source.split(",")) {
    const [name, rate] = chunk.split(":");
    const key = String(name ?? "")
      .trim()
      .toUpperCase();
    const numericRate = Number(rate ?? "");

    if (
      !key ||
      !Number.isFinite(numericRate) ||
      numericRate < 0 ||
      numericRate > 1
    ) {
      continue;
    }
    map.set(key, numericRate);
  }

  return map;
}

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  const time = d.getTime();

  return Number.isFinite(time) ? time : null;
}

function resolveUsdCopRateByDate(args: {
  timeline: ExchangeRateTimelinePoint[];
  targetDate: Date | string | null | undefined;
  fallbackRate: number;
}) {
  const { timeline, targetDate, fallbackRate } = args;

  if (!timeline.length) return fallbackRate;

  const targetMs = toTimestamp(targetDate);

  if (targetMs === null) {
    return timeline[timeline.length - 1]?.rate ?? fallbackRate;
  }

  let low = 0;
  let high = timeline.length - 1;
  let foundIndex = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    if (timeline[mid]!.atMs <= targetMs) {
      foundIndex = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (foundIndex >= 0) {
    return timeline[foundIndex]!.rate;
  }

  return timeline[0]!.rate;
}

function styleHeaderRow(sheet: ExcelJS.Worksheet, rowNumber: number) {
  const row = sheet.getRow(rowNumber);

  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

function styleBodyBorders(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "exports:reports:accounting-macro",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const dateFrom = parseDateParam(searchParams.get("dateFrom") ?? "");
  const dateTo = parseDateParam(searchParams.get("dateTo") ?? "", true);
  const usdToCop = Math.max(1, Number(searchParams.get("usdToCop") ?? 3700));
  const defaultCommissionRate = Math.min(
    1,
    Math.max(0, Number(searchParams.get("defaultCommissionRate") ?? 0.05)),
  );
  const advisorRates = parseAdvisorRates(searchParams.get("advisorRates"));

  const dbAdvisorRateRows = await db
    .select({
      advisorName: advisorCommissionRates.advisorName,
      rate: advisorCommissionRates.rate,
    })
    .from(advisorCommissionRates)
    .where(eq(advisorCommissionRates.isActive, true));
  const dbAdvisorRates = new Map<string, number>();

  for (const row of dbAdvisorRateRows) {
    const key = String(row.advisorName ?? "")
      .trim()
      .toUpperCase();
    const rate = Number(row.rate ?? 0);

    if (!key || !Number.isFinite(rate) || rate < 0 || rate > 1) continue;
    dbAdvisorRates.set(key, rate);
  }

  const orderFilters: Array<any> = [];

  if (dateFrom) orderFilters.push(gte(orders.createdAt, dateFrom));
  if (dateTo) orderFilters.push(lte(orders.createdAt, dateTo));

  const ordersQuery = db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      createdAt: orders.createdAt,
      status: orders.status,
      currency: orders.currency,
      total: orders.total,
      shippingFee: (orders as any).shippingFee,
      clientName: clients.name,
      advisorName: employees.name,
      deliveryDate: quotations.deliveryDate,
    })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .leftJoin(employees, eq(orders.createdBy, employees.id))
    .leftJoin(prefacturas, eq(prefacturas.orderId, orders.id))
    .leftJoin(quotations, eq(prefacturas.quotationId, quotations.id));

  const salesOrders = (orderFilters.length
    ? await ordersQuery.where(and(...orderFilters))
    : await ordersQuery) as MacroOrderRow[];

  const orderIds = salesOrders.map((row) => row.id).filter(Boolean);

  const paymentFilters: Array<any> = [
    orderIds.length ? inArray(orderPayments.orderId, orderIds) : undefined,
  ].filter(Boolean);

  if (dateFrom) paymentFilters.push(gte(orderPayments.createdAt, dateFrom));
  if (dateTo) paymentFilters.push(lte(orderPayments.createdAt, dateTo));

  const paymentsQuery = db
    .select({
      id: orderPayments.id,
      orderId: orderPayments.orderId,
      orderCode: orders.orderCode,
      bankCode: banks.code,
      bankName: banks.name,
      referenceCode: orderPayments.referenceCode,
      transferCurrency: orderPayments.transferCurrency,
      depositAmount: orderPayments.depositAmount,
      amount: orderPayments.amount,
      status: orderPayments.status,
      createdAt: orderPayments.createdAt,
    })
    .from(orderPayments)
    .leftJoin(orders, eq(orderPayments.orderId, orders.id))
    .leftJoin(banks, eq(orderPayments.bankId, banks.id));

  const allPayments = (paymentFilters.length
    ? await paymentsQuery.where(and(...paymentFilters))
    : await paymentsQuery) as MacroPaymentRow[];

  const rawUsdCopRates = await db
    .select({
      effectiveRate: exchangeRates.effectiveRate,
      sourceDate: exchangeRates.sourceDate,
      createdAt: exchangeRates.createdAt,
    })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.baseCurrency, "USD"),
        eq(exchangeRates.targetCurrency, "COP"),
      ),
    )
    .orderBy(desc(exchangeRates.sourceDate), desc(exchangeRates.createdAt))
    .limit(2000);

  const usdCopTimeline = rawUsdCopRates
    .map((row) => {
      const atMs =
        toTimestamp(row.sourceDate) ?? toTimestamp(row.createdAt) ?? null;
      const rate = asNumber(row.effectiveRate);

      if (atMs === null || !Number.isFinite(rate) || rate <= 0) return null;

      return {
        atMs,
        rate,
      } satisfies ExchangeRateTimelinePoint;
    })
    .filter((row): row is ExchangeRateTimelinePoint => Boolean(row))
    .sort((a, b) => a.atMs - b.atMs);

  const paymentsByOrder = new Map<string, MacroPaymentRow[]>();

  for (const payment of allPayments) {
    const orderId = String(payment.orderId ?? "").trim();

    if (!orderId) continue;
    const current = paymentsByOrder.get(orderId) ?? [];

    current.push(payment);
    paymentsByOrder.set(orderId, current);
  }

  for (const [key, rows] of paymentsByOrder.entries()) {
    rows.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      return aTime - bTime;
    });
    paymentsByOrder.set(key, rows);
  }

  const workbook = new ExcelJS.Workbook();

  workbook.creator = "VIOMAR";
  workbook.created = new Date();

  const ventasSheet = workbook.addWorksheet("Ventas");

  ventasSheet.columns = [
    { header: "PEDIDO", key: "pedido", width: 16 },
    { header: "MODELO DE BONIFICACION", key: "modeloBonificacion", width: 24 },
    { header: "FECHA PEDIDO", key: "fechaPedido", width: 16 },
    { header: "CLIENTE", key: "cliente", width: 30 },
    { header: "FECHA DE ENTREGA", key: "fechaEntrega", width: 16 },
    { header: "ASESOR PRINCIPAL", key: "asesorPrincipal", width: 20 },
    { header: "ASESOR", key: "asesor", width: 20 },
    { header: "VALOR PEDIDO", key: "valorPedido", width: 18 },
    { header: "%", key: "porcentajePagado", width: 10 },
    { header: "ANTICIPO", key: "anticipo", width: 16 },
    { header: "ABONO", key: "abono", width: 16 },
    { header: "DEBE", key: "debe", width: 16 },
    { header: "CANCELADO", key: "cancelado", width: 12 },
    { header: "ENTREGADO", key: "entregado", width: 12 },
    { header: "FECHA ENTREGA", key: "fechaEntregaReal", width: 16 },
    { header: "SEMANA/PAGADA", key: "semanaPagada", width: 14 },
    { header: "Comision PEDIDOS", key: "comisionPedidos", width: 18 },
    { header: "FECHA PAGO", key: "fechaPago", width: 16 },
    { header: "PAGO", key: "pago", width: 16 },
    { header: "% Comision", key: "porcentajeComision", width: 12 },
  ];
  styleHeaderRow(ventasSheet, 1);

  const comisionesAccumulator = new Map<
    string,
    {
      asesorPrincipal: string;
      asesor: string;
      ventasCop: number;
      pagoCop: number;
      comisionRate: number;
      comisionTotalCop: number;
    }
  >();

  for (const order of salesOrders) {
    const currency = normalizeCurrency(order.currency);
    const totalPedido = asNumber(order.total) + asNumber(order.shippingFee);
    const relatedPayments = paymentsByOrder.get(order.id) ?? [];
    const confirmedPayments = relatedPayments.filter((row) =>
      CONFIRMED_PAYMENT_STATUSES.has(String(row.status ?? "").toUpperCase()),
    );
    const totalPaid = confirmedPayments.reduce(
      (sum, row) => sum + asNumber(row.amount),
      0,
    );
    const firstConfirmed = confirmedPayments[0] ?? null;
    const lastConfirmed =
      confirmedPayments.length > 0
        ? confirmedPayments[confirmedPayments.length - 1]
        : null;
    const anticipo = firstConfirmed ? asNumber(firstConfirmed.amount) : 0;
    const abono = Math.max(0, totalPaid - anticipo);
    const debe = Math.max(0, totalPedido - totalPaid);
    const paidPercent = totalPedido > 0 ? totalPaid / totalPedido : 0;
    const asesorPrincipal = String(order.advisorName ?? "SIN ASESOR").trim();
    const asesor = asesorPrincipal;
    const normalizedAdvisor = asesorPrincipal.toUpperCase();
    const commissionRate =
      advisorRates.get(normalizedAdvisor) ??
      dbAdvisorRates.get(normalizedAdvisor) ??
      defaultCommissionRate;
    const usdCopRateForOrder = resolveUsdCopRateByDate({
      timeline: usdCopTimeline,
      targetDate: order.createdAt,
      fallbackRate: usdToCop,
    });
    const totalPedidoCop =
      currency === "USD" ? totalPedido * usdCopRateForOrder : totalPedido;
    const totalPaidCop =
      currency === "USD"
        ? confirmedPayments.reduce((sum, row) => {
            const usdCopRateForPayment = resolveUsdCopRateByDate({
              timeline: usdCopTimeline,
              targetDate: row.createdAt,
              fallbackRate: usdToCop,
            });

            return sum + asNumber(row.amount) * usdCopRateForPayment;
          }, 0)
        : totalPaid;
    const commissionAmountCop = totalPedidoCop * commissionRate;

    ventasSheet.addRow({
      pedido: order.orderCode,
      modeloBonificacion: "",
      fechaPedido: formatDate(order.createdAt),
      cliente: order.clientName ?? "",
      fechaEntrega: formatDate(order.deliveryDate),
      asesorPrincipal,
      asesor,
      valorPedido: totalPedido,
      porcentajePagado: paidPercent,
      anticipo,
      abono,
      debe,
      cancelado:
        String(order.status ?? "").toUpperCase() === "CANCELADO"
          ? "Cancelado"
          : "",
      entregado:
        String(order.status ?? "").toUpperCase() === "ENTREGADO"
          ? "Entregado"
          : "",
      fechaEntregaReal: formatDate(order.deliveryDate),
      semanaPagada: getIsoWeek(lastConfirmed?.createdAt),
      comisionPedidos: commissionAmountCop,
      fechaPago: formatDate(lastConfirmed?.createdAt),
      pago: totalPaid,
      porcentajeComision: commissionRate,
    });

    const commKey = `${asesorPrincipal}::${asesor}`;
    const current = comisionesAccumulator.get(commKey) ?? {
      asesorPrincipal,
      asesor,
      ventasCop: 0,
      pagoCop: 0,
      comisionRate: commissionRate,
      comisionTotalCop: 0,
    };

    current.ventasCop += totalPedidoCop;
    current.pagoCop += totalPaidCop;
    current.comisionTotalCop += commissionAmountCop;
    current.comisionRate = commissionRate;
    comisionesAccumulator.set(commKey, current);
  }

  ventasSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    styleBodyBorders(row);
    row.getCell(8).numFmt = '"$"#,##0.00';
    row.getCell(9).numFmt = "0%";
    row.getCell(10).numFmt = '"$"#,##0.00';
    row.getCell(11).numFmt = '"$"#,##0.00';
    row.getCell(12).numFmt = '"$"#,##0.00';
    row.getCell(17).numFmt = '"$"#,##0.00';
    row.getCell(19).numFmt = '"$"#,##0.00';
    row.getCell(20).numFmt = "0%";
  });

  const abonosSheet = workbook.addWorksheet("Abonos");

  abonosSheet.columns = [
    { header: "PEDIDO", key: "pedido", width: 16 },
    { header: "BANCO", key: "banco", width: 22 },
    { header: "# CONSIGNACION", key: "consignacion", width: 20 },
    { header: "MONEDA", key: "moneda", width: 10 },
    { header: "FECHA ABONO", key: "fechaAbono", width: 16 },
    { header: "TOTAL CONSIGNACION", key: "totalConsignacion", width: 20 },
    {
      header: "VALOR A PAGAR EN EL PEDIDO",
      key: "valorPagarPedido",
      width: 26,
    },
    { header: "VALOR A FAVOR", key: "valorFavor", width: 16 },
  ];
  styleHeaderRow(abonosSheet, 1);

  for (const payment of allPayments) {
    if (String(payment.status ?? "").toUpperCase() === "ANULADO") continue;

    const currency = normalizeCurrency(payment.transferCurrency);
    const totalConsignacion = asNumber(payment.depositAmount || payment.amount);
    const valorPedido = asNumber(payment.amount);
    const valorFavor = Math.max(0, totalConsignacion - valorPedido);
    const bankLabel = [payment.bankCode, payment.bankName]
      .filter(Boolean)
      .join(" ")
      .trim();

    abonosSheet.addRow({
      pedido: payment.orderCode ?? "",
      banco: bankLabel || "EFECTIVO",
      consignacion: payment.referenceCode ?? "",
      moneda: currency,
      fechaAbono: formatDate(payment.createdAt),
      totalConsignacion,
      valorPagarPedido: valorPedido,
      valorFavor,
    });
  }

  abonosSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    styleBodyBorders(row);
    row.getCell(6).numFmt = '"$"#,##0.00';
    row.getCell(7).numFmt = '"$"#,##0.00';
    row.getCell(8).numFmt = '"$"#,##0.00';
  });

  const comisionesSheet = workbook.addWorksheet("Comisiones");

  comisionesSheet.columns = [
    { header: "ASESOR PRINCIPAL", key: "asesorPrincipal", width: 22 },
    { header: "ASESOR", key: "asesor", width: 22 },
    { header: "VENTAS (COP)", key: "ventasCop", width: 18 },
    { header: "PAGO (COP)", key: "pagoCop", width: 18 },
    { header: "% COMISION", key: "comisionRate", width: 14 },
    { header: "COMISION", key: "comisionTotalCop", width: 18 },
  ];
  styleHeaderRow(comisionesSheet, 1);

  for (const row of Array.from(comisionesAccumulator.values()).sort((a, b) =>
    a.asesorPrincipal.localeCompare(b.asesorPrincipal),
  )) {
    comisionesSheet.addRow(row);
  }

  let comisionGrandTotal = 0;

  comisionesSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    styleBodyBorders(row);
    row.getCell(3).numFmt = '"$"#,##0.00';
    row.getCell(4).numFmt = '"$"#,##0.00';
    row.getCell(5).numFmt = "0%";
    row.getCell(6).numFmt = '"$"#,##0.00';
    comisionGrandTotal += asNumber(row.getCell(6).value);
  });

  const totalRow = comisionesSheet.addRow({
    asesorPrincipal: "TOTAL",
    comisionTotalCop: comisionGrandTotal,
  });

  totalRow.font = { bold: true };
  styleBodyBorders(totalRow);
  totalRow.getCell(6).numFmt = '"$"#,##0.00';

  const stamp = new Date();
  const filename = `contabilidad-macro-${stamp.getFullYear()}-${String(
    stamp.getMonth() + 1,
  ).padStart(2, "0")}.xlsx`;

  return workbookToXlsxResponse(workbook, filename);
}
