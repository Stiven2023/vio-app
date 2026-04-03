/**
 * GET /api/exports/mes/matriz-despacho?orderId=<uuid>
 * Exporta la Matriz de Despacho para un pedido: recorre los envíos (mes_envios)
 * con sus ítems, fechas, estado de pago, aprobaciones y logística.
 */
import ExcelJS from "exceljs";
import { desc, eq, inArray } from "drizzle-orm";

import { db, mesDb } from "@/src/db";
import { orderItems, orders } from "@/src/db/schema";
import { mesEnvioItems, mesEnvios } from "@/src/db/mes/schema";
import { jsonError, jsonForbidden } from "@/src/utils/api-error";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import { workbookToXlsxResponse } from "@/src/utils/exceljs-export";

function fmtDate(v: unknown) {
  const d = new Date(String(v ?? ""));

  if (Number.isNaN(d.getTime())) return "-";

  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtBool(v: unknown) {
  return v ? "SÍ" : "NO";
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "exports:mes:matriz-despacho",
    limit: 30,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_MES");

  if (forbidden) return jsonForbidden();

  const { searchParams } = new URL(request.url);
  const orderId = String(searchParams.get("orderId") ?? "").trim();

  if (!orderId) {
    return jsonError(400, "VALIDATION_ERROR", "El pedido es obligatorio.", {
      orderId: ["Debes indicar el pedido a exportar."],
    });
  }

  // --- Datos del pedido ---
  const [order] = await db
    .select({ id: orders.id, code: orders.orderCode })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  // --- Envíos del pedido ---
  const envioRows = await mesDb
    .select()
    .from(mesEnvios)
    .where(eq(mesEnvios.orderId, orderId))
    .orderBy(desc(mesEnvios.createdAt));

  const envioIds = envioRows.map((r) => r.id);

  // --- Ítems de los envíos ---
  const itemRows = envioIds.length
    ? await mesDb
        .select()
        .from(mesEnvioItems)
        .where(inArray(mesEnvioItems.envioId, envioIds))
    : [];

  const orderItemIds = [...new Set(itemRows.map((r) => String(r.orderItemId)))];
  const erpItems = orderItemIds.length
    ? await db
        .select({ id: orderItems.id, name: orderItems.name })
        .from(orderItems)
        .where(inArray(orderItems.id, orderItemIds))
    : [];
  const itemNameById = new Map(erpItems.map((r) => [r.id, r.name]));

  // --- Construir libro Excel ---
  const wb = new ExcelJS.Workbook();

  wb.creator = "Viomar MES";
  wb.created = new Date();

  // Hoja DESPACHO
  const wsDespacho = wb.addWorksheet("DESPACHO");

  const titleRow = wsDespacho.addRow([
    `MATRIZ DE DESPACHO — Pedido ${order?.code ?? orderId}`,
  ]);

  titleRow.font = { bold: true, size: 13 };
  wsDespacho.mergeCells(`A1:R1`);

  wsDespacho.addRow([]); // fila vacía

  const headers = [
    "# Envío",
    "Estado",
    "Área Origen",
    "Área Destino",
    "Transporte",
    "Empresa 3°",
    "Operador Logístico",
    "Dirección Destino",
    "Mensajero Trae",
    "Requiere VR",
    "Cantidad Empacada",
    "Fecha Salida",
    "Fecha Llegada",
    "Fecha Retorno",
    "Estado de Pago",
    "Ubicación Recepción",
    "Estado Recepción",
    "Aprobaciones",
  ];
  const headRow = wsDespacho.addRow(headers);

  headRow.font = { bold: true };
  headRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E40BF" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", wrapText: true };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  let rowIndex = 0;

  for (const envio of envioRows) {
    rowIndex++;
    const items = itemRows.filter((i) => i.envioId === envio.id);
    const totalPacked = items.reduce(
      (s, i) => s + (i.packedQuantity ?? i.quantity),
      0,
    );
    const approvalsJson = envio.dispatchApprovals as Record<string, any> | null;
    const approvalsText = approvalsJson
      ? [
          `Vendedor: ${approvalsJson.seller?.approved ? "✓ " + (approvalsJson.seller?.approverName ?? "") : "✗"}`,
          `Cartera: ${approvalsJson.cartera?.approved ? "✓ " + (approvalsJson.cartera?.approverName ?? "") : "✗"}`,
          `Contab.: ${approvalsJson.accounting?.approved ? "✓ " + (approvalsJson.accounting?.approverName ?? "") : "✗"}`,
        ].join("\n")
      : "N/A";

    const dataRow = wsDespacho.addRow([
      rowIndex,
      envio.status,
      envio.origenArea,
      envio.destinoArea,
      envio.transporteTipo,
      envio.empresaTercero ?? "-",
      envio.logisticOperator ?? "-",
      envio.destinationAddress ?? "-",
      envio.courierBroughtBy ?? "-",
      fmtBool(envio.requiresDeclaredValue),
      totalPacked,
      fmtDate(envio.salidaAt),
      fmtDate(envio.llegadaAt),
      fmtDate(envio.retornoAt),
      envio.paymentStatus,
      envio.receptionLocation ?? "-",
      envio.receptionStatus ?? "-",
      approvalsText,
    ]);

    dataRow.alignment = { wrapText: true, vertical: "top" };
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });
  }

  // Hoja ITEMS
  const wsItems = wb.addWorksheet("ITEMS DE ENVÍOS");
  const itemsTitle = wsItems.addRow([
    `ítems por envío — Pedido ${order?.code ?? orderId}`,
  ]);

  itemsTitle.font = { bold: true, size: 13 };
  wsItems.mergeCells("A1:E1");
  wsItems.addRow([]);

  const itemHeaders = [
    "# Envío",
    "Estado Envío",
    "Diseño",
    "Cantidad Pedida",
    "Cantidad Empacada",
  ];
  const itemHead = wsItems.addRow(itemHeaders);

  itemHead.font = { bold: true };
  itemHead.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E40BF" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  let iIdx = 0;

  for (const envio of envioRows) {
    iIdx++;
    const items = itemRows.filter((i) => i.envioId === envio.id);

    for (const item of items) {
      const row = wsItems.addRow([
        iIdx,
        envio.status,
        itemNameById.get(String(item.orderItemId)) ?? item.orderItemId,
        item.quantity,
        item.packedQuantity ?? item.quantity,
      ]);

      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
      });
    }
  }

  // Anchos de columna
  wsDespacho.columns = [
    { width: 8 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 20 },
    { width: 22 },
    { width: 30 },
    { width: 22 },
    { width: 12 },
    { width: 16 },
    { width: 20 },
    { width: 20 },
    { width: 20 },
    { width: 18 },
    { width: 24 },
    { width: 18 },
    { width: 36 },
  ];
  wsItems.columns = [
    { width: 8 },
    { width: 14 },
    { width: 40 },
    { width: 18 },
    { width: 18 },
  ];

  const filename = `matriz-despacho-${order?.code ?? orderId}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return workbookToXlsxResponse(wb, filename);
}
