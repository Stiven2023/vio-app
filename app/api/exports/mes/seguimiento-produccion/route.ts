/**
 * GET /api/exports/mes/seguimiento-produccion?orderId=<uuid>&period=2026-04
 * Exporta el Seguimiento de Producción: etapas por ítem, reposiciones,
 * aprobaciones de muestra y métricas por operario/área.
 */
import ExcelJS from "exceljs";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";

import { db, mesDb } from "@/src/db";
import { orderItems, orders } from "@/src/db/schema";
import {
  mesSampleApprovals,
  mesProductionStages,
  mesReposiciones,
  mesProductionQueue,
} from "@/src/db/mes/schema";
import { jsonError, jsonForbidden } from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { workbookToXlsxResponse } from "@/src/utils/exceljs-export";

function fmtDate(v: unknown) {
  const d = new Date(String(v ?? ""));

  if (Number.isNaN(d.getTime())) return "-";

  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateTime(v: unknown) {
  const d = new Date(String(v ?? ""));

  if (Number.isNaN(d.getTime())) return "-";

  return `${fmtDate(v)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Duración en minutos entre dos timestamps */
function minutesBetween(start: unknown, end: unknown) {
  const s = new Date(String(start ?? "")).getTime();
  const e = new Date(String(end ?? "")).getTime();

  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;

  return Math.round((e - s) / 60_000);
}

function deliveryStatus(deliveryDate: unknown) {
  if (!deliveryDate) return "-";
  const d = new Date(String(deliveryDate));

  if (Number.isNaN(d.getTime())) return "-";

  return d < new Date() ? "TARDE" : "A TIEMPO";
}

function applyHeader(
  row: ExcelJS.Row,
  bgArgb = "FF1E40BF",
  fgArgb = "FFFFFFFF",
) {
  row.font = { bold: true, color: { argb: fgArgb } };
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: bgArgb },
    };
    cell.font = { bold: true, color: { argb: fgArgb } };
    cell.alignment = { horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

function applyData(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
    cell.alignment = { vertical: "top", wrapText: true };
  });
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "exports:mes:seguimiento-produccion",
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MES");

  if (forbidden) return jsonForbidden();

  const { searchParams } = new URL(request.url);
  const orderId = String(searchParams.get("orderId") ?? "").trim();
  const period = String(searchParams.get("period") ?? "").trim(); // "2026-04"

  let periodStart: Date | undefined;
  let periodEnd: Date | undefined;

  if (period) {
    const [y, m] = period.split("-").map(Number);

    if (y && m) {
      periodStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
      periodEnd = new Date(y, m, 0, 23, 59, 59, 999);
    }
  }

  if (!orderId && !period) {
    return jsonError(
      400,
      "VALIDATION_ERROR",
      "Debes indicar orderId o period (YYYY-MM).",
      {
        orderId: ["Se requiere al menos un filtro."],
      },
    );
  }

  // --- Obtener órdenes de producción según filtro ---
  const queueConditions = [];

  if (orderId) queueConditions.push(eq(mesProductionQueue.orderId, orderId));
  const queueRows = await mesDb
    .select()
    .from(mesProductionQueue)
    .where(queueConditions.length ? and(...queueConditions) : undefined)
    .orderBy(desc(mesProductionQueue.createdAt))
    .limit(500);

  const orderIds = [...new Set(queueRows.map((r) => String(r.orderId)))];
  const orderItemIds = [
    ...new Set(queueRows.map((r) => String(r.orderItemId))),
  ];

  // ERP: info de pedidos y diseños
  const erpOrders = orderIds.length
    ? await db
        .select({
          id: orders.id,
          code: orders.orderCode,
          deliveryDate: orders.deliveryDate,
        })
        .from(orders)
        .where(inArray(orders.id, orderIds))
    : [];
  const orderById = new Map(erpOrders.map((r) => [r.id, r]));

  const erpItems = orderItemIds.length
    ? await db
        .select({ id: orderItems.id, name: orderItems.name })
        .from(orderItems)
        .where(inArray(orderItems.id, orderItemIds))
    : [];
  const itemNameById = new Map(erpItems.map((r) => [r.id, r.name]));

  // --- Etapas de producción ---
  const stageConditions = [];

  if (orderId) stageConditions.push(eq(mesProductionStages.orderId, orderId));
  if (periodStart && periodEnd) {
    stageConditions.push(gte(mesProductionStages.createdAt, periodStart));
    stageConditions.push(lte(mesProductionStages.createdAt, periodEnd));
  }

  const stages = await mesDb
    .select()
    .from(mesProductionStages)
    .where(stageConditions.length ? and(...stageConditions) : undefined)
    .orderBy(
      mesProductionStages.orderId,
      mesProductionStages.orderItemId,
      mesProductionStages.area,
    );

  // --- Reposiciones ---
  const repoConditions = [];

  if (orderId) repoConditions.push(eq(mesReposiciones.orderId, orderId));
  const reposiciones = await mesDb
    .select()
    .from(mesReposiciones)
    .where(repoConditions.length ? and(...repoConditions) : undefined)
    .orderBy(mesReposiciones.createdAt);

  // --- Aprobaciones de muestra ---
  const sampleConditions = [];

  if (orderId) sampleConditions.push(eq(mesSampleApprovals.orderId, orderId));
  const sampleApprovals = await mesDb
    .select()
    .from(mesSampleApprovals)
    .where(sampleConditions.length ? and(...sampleConditions) : undefined);
  const sampleByOrderId = new Map(
    sampleApprovals.map((r) => [String(r.orderId), r]),
  );

  // --- Construir libro Excel ---
  const wb = new ExcelJS.Workbook();

  wb.creator = "Viomar MES";
  wb.created = new Date();

  // ── Hoja PROGRAMACION ──────────────────────────────────────────────────────
  const wsProg = wb.addWorksheet("PROGRAMACION");
  const titleProg = wsProg.addRow([
    `SEGUIMIENTO DE PRODUCCIÓN${orderId ? ` — Pedido ${orderById.get(orderId)?.code ?? orderId}` : ""}${period ? ` — ${period}` : ""}`,
  ]);

  titleProg.font = { bold: true, size: 13 };
  wsProg.mergeCells("A1:R1");
  wsProg.addRow([]);

  const progHeaders = [
    "Pedido",
    "Diseño",
    "Talla",
    "Cant. Total",
    "Prioridad",
    "Estado Cola",
    "Confirmado En",
    "PIN Montaje",
    "Estado Muestra",
    "Fecha Aprobación Muestra",
    "Aprobado Por",
    "Entrega Esperada",
    "Estado Entrega",
  ];

  applyHeader(wsProg.addRow(progHeaders));

  for (const q of queueRows) {
    const ord = orderById.get(String(q.orderId));
    const sample = sampleByOrderId.get(String(q.orderId));
    const row = wsProg.addRow([
      ord?.code ?? q.orderId,
      itemNameById.get(String(q.orderItemId)) ?? q.orderItemId,
      q.size ?? "-",
      q.quantityTotal,
      q.priority,
      q.status,
      fmtDate(q.confirmedAt),
      sample?.assemblyPin ?? "-",
      sample?.sampleApprovalStatus ?? "PENDIENTE",
      fmtDate(sample?.sampleApprovedAt),
      sample?.sampleApprovedBy ?? "-",
      fmtDate(ord?.deliveryDate),
      deliveryStatus(ord?.deliveryDate),
    ]);

    applyData(row);
  }

  wsProg.columns = [
    { width: 14 },
    { width: 36 },
    { width: 10 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 20 },
    { width: 14 },
    { width: 18 },
    { width: 24 },
    { width: 24 },
    { width: 20 },
    { width: 14 },
  ];

  // ── Hoja ETAPAS ───────────────────────────────────────────────────────────
  const wsEtapas = wb.addWorksheet("ETAPAS PRODUCCIÓN");

  wsEtapas.addRow(["ETAPAS DE PRODUCCIÓN POR ÁREA"]).font = {
    bold: true,
    size: 13,
  };
  wsEtapas.mergeCells("A1:L1");
  wsEtapas.addRow([]);

  const etapasHeaders = [
    "Pedido",
    "Diseño",
    "Área",
    "Etapa",
    "Inicio",
    "Fin",
    "Tiempo (min)",
    "Operario",
    "Máquina",
    "Cant. Procesada",
    "Notas",
  ];

  applyHeader(wsEtapas.addRow(etapasHeaders));

  for (const s of stages) {
    const order = orderById.get(String(s.orderId));
    const row = wsEtapas.addRow([
      order?.code ?? s.orderId,
      itemNameById.get(String(s.orderItemId)) ?? s.orderItemId,
      s.area,
      s.stageName ?? "-",
      fmtDateTime(s.startedAt),
      fmtDateTime(s.endedAt),
      minutesBetween(s.startedAt, s.endedAt) ?? "-",
      s.operatorName ?? "-",
      s.machineName ?? "-",
      s.quantityProcessed,
      s.notes ?? "-",
    ]);

    applyData(row);
  }

  wsEtapas.columns = [
    { width: 14 },
    { width: 36 },
    { width: 18 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 14 },
    { width: 24 },
    { width: 20 },
    { width: 16 },
    { width: 30 },
  ];

  // ── Hoja REPOSICIÓN ────────────────────────────────────────────────────────
  const wsRepo = wb.addWorksheet("REPOSICION");

  wsRepo.addRow(["REPOSICIONES"]).font = { bold: true, size: 13 };
  wsRepo.mergeCells("A1:J1");
  wsRepo.addRow([]);

  const repoHeaders = [
    "Código RD",
    "Pedido",
    "Diseño",
    "Causa",
    "Proceso Solicitante",
    "Cant. Solicitada",
    "Estado",
    "Solicitado En",
    "Cerrado En",
    "Notas",
  ];

  applyHeader(wsRepo.addRow(repoHeaders), "FF7C3AED");

  for (const r of reposiciones) {
    const ord = orderById.get(String(r.orderId));
    const row = wsRepo.addRow([
      r.repositionCode,
      ord?.code ?? r.orderId,
      itemNameById.get(String(r.orderItemId)) ?? r.orderItemId,
      r.causeCode,
      r.requestingProcess ?? "-",
      r.quantityRequested,
      r.status,
      fmtDate(r.createdAt),
      fmtDate(r.closedAt),
      r.notes ?? "-",
    ]);

    applyData(row);
  }

  wsRepo.columns = [
    { width: 14 },
    { width: 14 },
    { width: 36 },
    { width: 14 },
    { width: 22 },
    { width: 16 },
    { width: 14 },
    { width: 20 },
    { width: 20 },
    { width: 30 },
  ];

  // ── Hoja INDICADORES ───────────────────────────────────────────────────────
  const wsInd = wb.addWorksheet("INDICADORES");

  wsInd.addRow(["INDICADORES POR OPERARIO Y ÁREA"]).font = {
    bold: true,
    size: 13,
  };
  wsInd.mergeCells("A1:F1");
  wsInd.addRow([]);

  const indHeaders = [
    "Operario",
    "Área",
    "Total Etapas",
    "Cant. Total Procesada",
    "Tiempo Promedio (min)",
    "Período",
  ];

  applyHeader(wsInd.addRow(indHeaders), "FF047857");

  // Agrupación en memoria
  const indMap = new Map<
    string,
    {
      operatorName: string;
      area: string;
      count: number;
      totalQty: number;
      totalMins: number;
      period: string;
    }
  >();

  for (const s of stages) {
    const key = `${s.operatorName ?? "Sin asignar"}||${s.area}`;
    const mins = minutesBetween(s.startedAt, s.endedAt) ?? 0;
    const existing = indMap.get(key);

    if (existing) {
      existing.count++;
      existing.totalQty += s.quantityProcessed;
      existing.totalMins += mins;
    } else {
      indMap.set(key, {
        operatorName: s.operatorName ?? "Sin asignar",
        area: s.area,
        count: 1,
        totalQty: s.quantityProcessed,
        totalMins: mins,
        period: period || fmtDate(s.createdAt).slice(0, 7),
      });
    }
  }

  for (const v of Array.from(indMap.values()).sort((a, b) =>
    a.operatorName.localeCompare(b.operatorName),
  )) {
    const row = wsInd.addRow([
      v.operatorName,
      v.area,
      v.count,
      v.totalQty,
      v.count > 0 ? Math.round(v.totalMins / v.count) : 0,
      v.period,
    ]);

    applyData(row);
  }

  wsInd.columns = [
    { width: 28 },
    { width: 20 },
    { width: 14 },
    { width: 22 },
    { width: 22 },
    { width: 14 },
  ];

  const suffix = period || fmtDate(new Date()).slice(0, 7);
  const filename = `seguimiento-produccion-${suffix}.xlsx`;

  return workbookToXlsxResponse(wb, filename);
}
