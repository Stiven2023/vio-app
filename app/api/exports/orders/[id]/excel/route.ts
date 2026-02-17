import ExcelJS from "exceljs";
import { eq, inArray } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Buffer as NodeBuffer } from "node:buffer";

import { db } from "@/src/db";
import {
  clients,
  inventoryItems,
  orderItemMaterials,
  orderItemPackaging,
  orderItemSocks,
  orderItems,
  orderPayments,
  orders,
} from "@/src/db/schema";
import { getEmployeeIdFromRequest, getRoleFromRequest } from "@/src/utils/auth-middleware";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";
import {
  addImageToCell,
  fetchImageBuffer,
  workbookToXlsxResponse,
} from "@/src/utils/exceljs-export";

function asNumber(v: unknown) {
  const n = Number(String(v ?? "0"));

  return Number.isFinite(n) ? n : 0;
}

function formatDate(value: unknown) {
  const d = new Date(String(value ?? ""));

  if (Number.isNaN(d.getTime())) return "-";

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}/${m}/${day}`;
}

function formatMoney(value: unknown, currency: string) {
  const n = asNumber(value);
  const cur = currency === "USD" ? "USD" : "COP";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: cur === "USD" ? 2 : 0,
    maximumFractionDigits: cur === "USD" ? 2 : 0,
  }).format(n);
}

type ImageExtension = "png" | "jpeg";

function imageBase64(buffer: NodeBuffer, extension: ImageExtension) {
  const mime = extension === "png" ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

type HeaderInfo = {
  companyName: string;
  companyNit: string;
  subtitle: string;
  orderCode: string;
  orderStatus: string;
  orderType: string;
  orderKind: string;
  currency: string;
  orderDate: string;
  clientName: string;
  clientNit: string;
  sourceOrderId: string;
};

function applyThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
}

function applyBorderRange(
  worksheet: ExcelJS.Worksheet,
  fromRow: number,
  toRow: number,
  fromCol: number,
  toCol: number,
) {
  for (let row = fromRow; row <= toRow; row += 1) {
    for (let col = fromCol; col <= toCol; col += 1) {
      applyThinBorder(worksheet.getCell(row, col));
    }
  }
}

function applyRowBorder(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  fromCol: number,
  toCol: number,
) {
  for (let col = fromCol; col <= toCol; col += 1) {
    applyThinBorder(worksheet.getCell(rowNumber, col));
  }
}

function styleSectionTitle(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  fromCol: number,
  toCol: number,
  title: string,
) {
  worksheet.mergeCells(rowNumber, fromCol, rowNumber, toCol);
  const cell = worksheet.getCell(rowNumber, fromCol);
  cell.value = title;
  cell.font = { bold: true };
  cell.alignment = { vertical: "middle", horizontal: "left" };
  applyRowBorder(worksheet, rowNumber, fromCol, toCol);
}

function styleTableHeader(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  fromCol: number,
  toCol: number,
) {
  const row = worksheet.getRow(rowNumber);
  row.font = { bold: true };
  for (let col = fromCol; col <= toCol; col += 1) {
    const cell = worksheet.getCell(rowNumber, col);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF3F4F6" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  }
  applyRowBorder(worksheet, rowNumber, fromCol, toCol);
}

function setCenteredCellValue(cell: ExcelJS.Cell, value: string) {
  cell.value = value;
  cell.alignment = { vertical: "middle", horizontal: "center" };
}

function centerRowCells(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  fromCol: number,
  toCol: number,
) {
  for (let col = fromCol; col <= toCol; col += 1) {
    worksheet.getCell(rowNumber, col).alignment = {
      vertical: "middle",
      horizontal: "center",
    };
  }
}

function setLabelValue(
  worksheet: ExcelJS.Worksheet,
  row: number,
  labelCol: number,
  valueCol: number,
  label: string,
  value: string,
) {
  const labelCell = worksheet.getCell(row, labelCol);
  labelCell.value = label;
  labelCell.font = { bold: true };

  const valueCell = worksheet.getCell(row, valueCol);
  valueCell.value = value;
}

function applyDocumentHeader(
  worksheet: ExcelJS.Worksheet,
  info: HeaderInfo,
  stickerImageId?: number,
) {
  worksheet.pageSetup = {
    orientation: "portrait",
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.7,
      right: 0.7,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3,
    },
  };

  worksheet.getColumn(1).width = 18;
  worksheet.getColumn(2).width = 28;
  worksheet.getColumn(3).width = 4;
  worksheet.getColumn(4).width = 18;
  worksheet.getColumn(5).width = 28;

  worksheet.mergeCells(1, 1, 1, 5);
  worksheet.mergeCells(2, 1, 2, 5);

  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = info.companyName;
  titleCell.font = { size: 18, bold: true };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };

  const subtitleCell = worksheet.getCell(2, 1);
  subtitleCell.value = info.subtitle;
  subtitleCell.font = { size: 11 };
  subtitleCell.alignment = { vertical: "middle", horizontal: "left" };

  worksheet.getRow(1).height = 26;
  worksheet.getRow(2).height = 18;
  worksheet.getRow(3).height = 6;

  setLabelValue(worksheet, 4, 1, 2, "Pedido", info.orderCode);
  setLabelValue(worksheet, 4, 4, 5, "Fecha", info.orderDate);
  setLabelValue(worksheet, 5, 1, 2, "Estado", info.orderStatus);
  setLabelValue(worksheet, 5, 4, 5, "Tipo", info.orderType);
  setLabelValue(worksheet, 6, 1, 2, "Kind", info.orderKind);
  setLabelValue(worksheet, 6, 4, 5, "Moneda", info.currency);
  setLabelValue(worksheet, 7, 1, 2, "Cliente", info.clientName);
  setLabelValue(worksheet, 7, 4, 5, "NIT Cliente", info.clientNit);
  setLabelValue(worksheet, 8, 1, 2, "NIT Empresa", info.companyNit);
  setLabelValue(worksheet, 8, 4, 5, "Pedido origen", info.sourceOrderId);

  applyBorderRange(worksheet, 1, 9, 1, 5);

  if (stickerImageId) {
    worksheet.addImage(stickerImageId, {
      tl: { col: 3.9, row: 0.1 },
      ext: { width: 120, height: 60 },
    });
  }

  return 11;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "exports:order:excel",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "VER_PEDIDO");

  if (forbidden) return forbidden;

  const { id } = await params;
  const orderId = String(id ?? "").trim();

  if (!orderId) return new Response("id required", { status: 400 });

  const [orderRow] = await db
    .select({
      id: orders.id,
      orderCode: orders.orderCode,
      kind: (orders as any).kind,
      sourceOrderId: (orders as any).sourceOrderId,
      createdBy: orders.createdBy,
      clientId: orders.clientId,
      clientName: clients.name,
      clientNit: clients.identification,
      type: orders.type,
      status: orders.status,
      ivaEnabled: orders.ivaEnabled,
      discount: orders.discount,
      currency: orders.currency,
      shippingFee: (orders as any).shippingFee,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderRow) return new Response("Not found", { status: 404 });

  const role = getRoleFromRequest(request);
  const employeeId = getEmployeeIdFromRequest(request);

  if (role === "ASESOR" && (!employeeId || orderRow.createdBy !== employeeId)) {
    return new Response("Forbidden", { status: 403 });
  }

  const items = await db
    .select({
      id: orderItems.id,
      name: orderItems.name,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
      status: orderItems.status,
      fabric: orderItems.fabric,
      process: orderItems.process,
      neckType: orderItems.neckType,
      sleeve: orderItems.sleeve,
      color: orderItems.color,
      gender: orderItems.gender,
      requiresSocks: orderItems.requiresSocks,
      imageUrl: orderItems.imageUrl,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const itemIds = items.map((item) => item.id).filter(Boolean);

  const packaging = itemIds.length
    ? await db
        .select({
          orderItemId: orderItemPackaging.orderItemId,
          mode: orderItemPackaging.mode,
          size: orderItemPackaging.size,
          quantity: orderItemPackaging.quantity,
          personName: orderItemPackaging.personName,
          personNumber: orderItemPackaging.personNumber,
        })
        .from(orderItemPackaging)
        .where(inArray(orderItemPackaging.orderItemId, itemIds as any))
    : [];

  const socks = itemIds.length
    ? await db
        .select({
          orderItemId: orderItemSocks.orderItemId,
          size: orderItemSocks.size,
          quantity: orderItemSocks.quantity,
          description: orderItemSocks.description,
          imageUrl: orderItemSocks.imageUrl,
        })
        .from(orderItemSocks)
        .where(inArray(orderItemSocks.orderItemId, itemIds as any))
    : [];

  const materials = itemIds.length
    ? await db
        .select({
          orderItemId: orderItemMaterials.orderItemId,
          inventoryItemId: orderItemMaterials.inventoryItemId,
          itemName: inventoryItems.name,
          quantity: orderItemMaterials.quantity,
          note: orderItemMaterials.note,
        })
        .from(orderItemMaterials)
        .leftJoin(
          inventoryItems,
          eq(orderItemMaterials.inventoryItemId, inventoryItems.id),
        )
        .where(inArray(orderItemMaterials.orderItemId, itemIds as any))
    : [];

  const payments = await db
    .select({
      id: orderPayments.id,
      amount: orderPayments.amount,
      method: orderPayments.method,
      status: orderPayments.status,
      proofImageUrl: orderPayments.proofImageUrl,
      createdAt: orderPayments.createdAt,
    })
    .from(orderPayments)
    .where(eq(orderPayments.orderId, orderId));

  const subtotal = items.reduce((acc, item) => {
    const qty = Number(item.quantity ?? 0);
    const unit = asNumber(item.unitPrice);
    const lineTotal =
      item.totalPrice !== null && item.totalPrice !== undefined
        ? asNumber(item.totalPrice)
        : unit * qty;

    return acc + lineTotal;
  }, 0);

  const discountPercent = Math.min(
    100,
    Math.max(0, asNumber(orderRow.discount)),
  );
  const discountAmount = subtotal * (discountPercent / 100);
  const totalAfterDiscount = subtotal - discountAmount;
  const shippingFee = Math.max(0, asNumber(orderRow.shippingFee));
  const grandTotal = totalAfterDiscount + shippingFee;

  const paidTotal = payments.reduce(
    (acc, pay) => (pay.status === "ANULADO" ? acc : acc + asNumber(pay.amount)),
    0,
  );
  const paidPercent =
    grandTotal > 0 ? Math.min(100, Math.max(0, (paidTotal / grandTotal) * 100)) : 0;
  const remaining = Math.max(0, grandTotal - paidTotal);

  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "VIOMAR";
  const companyNit = process.env.NEXT_PUBLIC_COMPANY_NIT ?? "-";
  const currency = String(orderRow.currency ?? "COP").toUpperCase();
  const orderDate = orderRow.createdAt ? formatDate(orderRow.createdAt) : "-";
  const sourceOrderId = orderRow.sourceOrderId
    ? String(orderRow.sourceOrderId)
    : "-";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = companyName;
  workbook.created = new Date();

  const stickerPath = path.join(
    process.cwd(),
    "public",
    "STICKER VIOMAR.png",
  );
  const stickerBuffer = await readFile(stickerPath).catch(() => null);
  const stickerImageId = stickerBuffer
    ? workbook.addImage({
        base64: imageBase64(stickerBuffer as NodeBuffer, "png"),
        extension: "png",
      })
    : undefined;

  const headerInfo: HeaderInfo = {
    companyName,
    companyNit,
    subtitle: "Sistema de Produccion",
    orderCode: orderRow.orderCode ?? "-",
    orderStatus: orderRow.status ?? "-",
    orderType: orderRow.type ?? "-",
    orderKind: orderRow.kind ?? "-",
    currency,
    orderDate,
    clientName: orderRow.clientName ?? "-",
    clientNit: orderRow.clientNit ?? "-",
    sourceOrderId,
  };

  const resumenSheet = workbook.addWorksheet("Resumen");
  let rowPointer = applyDocumentHeader(resumenSheet, headerInfo, stickerImageId);
  rowPointer += 1;

  styleSectionTitle(resumenSheet, rowPointer, 1, 5, "Totales");
  rowPointer += 1;

  const resumenRows = [
    ["Subtotal", formatMoney(subtotal, currency)],
    ["Descuento %", String(discountPercent)],
    ["Descuento", formatMoney(discountAmount, currency)],
    ["Flete", formatMoney(shippingFee, currency)],
    ["Total", formatMoney(grandTotal, currency)],
    ["Abonado", formatMoney(paidTotal, currency)],
    ["Abono %", String(Math.round(paidPercent * 100) / 100)],
    ["Saldo", formatMoney(remaining, currency)],
  ];

  for (const [label, value] of resumenRows) {
    resumenSheet.getCell(rowPointer, 1).value = label;
    resumenSheet.getCell(rowPointer, 1).font = { bold: true };
    resumenSheet.getCell(rowPointer, 2).value = value;
    resumenSheet.mergeCells(rowPointer, 2, rowPointer, 5);
    resumenSheet.getCell(rowPointer, 2).alignment = {
      vertical: "middle",
      horizontal: "right",
    };
    applyRowBorder(resumenSheet, rowPointer, 1, 5);
    rowPointer += 1;
  }

  const prefacturaSheet = workbook.addWorksheet("Prefactura");
  rowPointer = applyDocumentHeader(prefacturaSheet, headerInfo, stickerImageId);
  prefacturaSheet.getColumn(1).width = 28;
  prefacturaSheet.getColumn(2).width = 12;
  prefacturaSheet.getColumn(3).width = 16;
  prefacturaSheet.getColumn(4).width = 16;
  prefacturaSheet.getColumn(5).width = 20;
  rowPointer += 1;

  styleSectionTitle(prefacturaSheet, rowPointer, 1, 5, "DETALLE DE PRODUCTOS");
  rowPointer += 1;

  prefacturaSheet.addRow(["Diseño", "Cantidad", "Unitario", "Total", "Imagen"]);
  styleTableHeader(prefacturaSheet, rowPointer, 1, 5);
  rowPointer += 1;

  for (const line of items) {
    const row = prefacturaSheet.addRow([
      line.name ?? "-",
      line.quantity ?? 0,
      formatMoney(line.unitPrice ?? 0, currency),
      formatMoney(line.totalPrice ?? 0, currency),
      "",
    ]);
    applyRowBorder(prefacturaSheet, row.number, 1, 5);
    centerRowCells(prefacturaSheet, row.number, 1, 5);
    rowPointer = row.number + 1;

    if (line.imageUrl) {
      const image = await fetchImageBuffer(line.imageUrl);
      if (image) {
        const imageId = workbook.addImage({
          base64: imageBase64(
            image.buffer as NodeBuffer,
            image.extension as ImageExtension,
          ),
          extension: image.extension,
        });
        addImageToCell(prefacturaSheet, imageId, row.number, 5, 80);
      } else {
        setCenteredCellValue(row.getCell(5), "Imagen no disponible");
      }
    } else {
      setCenteredCellValue(row.getCell(5), "Imagen no disponible");
    }
  }

  rowPointer += 1;
  styleSectionTitle(prefacturaSheet, rowPointer, 1, 5, "RESUMEN FINANCIERO");
  rowPointer += 1;

  const resumenPrefactura = [
    ["Subtotal", formatMoney(subtotal, currency)],
    ["Descuento %", String(discountPercent)],
    ["Descuento", formatMoney(discountAmount, currency)],
    ["Flete", formatMoney(shippingFee, currency)],
    ["Total", formatMoney(grandTotal, currency)],
    ["Abonado", formatMoney(paidTotal, currency)],
    ["Abono %", String(Math.round(paidPercent * 100) / 100)],
    ["Saldo", formatMoney(remaining, currency)],
  ];

  for (const [label, value] of resumenPrefactura) {
    const isEmphasis = label === "Total" || label === "Saldo";
    prefacturaSheet.getCell(rowPointer, 1).value = label;
    prefacturaSheet.getCell(rowPointer, 1).font = { bold: true };
    prefacturaSheet.getCell(rowPointer, 2).value = value;
    prefacturaSheet.mergeCells(rowPointer, 2, rowPointer, 5);
    prefacturaSheet.getCell(rowPointer, 2).alignment = {
      vertical: "middle",
      horizontal: "right",
    };
    if (isEmphasis) {
      prefacturaSheet.getCell(rowPointer, 2).font = { bold: true };
    }
    applyRowBorder(prefacturaSheet, rowPointer, 1, 5);
    rowPointer += 1;
  }

  rowPointer += 1;
  styleSectionTitle(prefacturaSheet, rowPointer, 1, 5, "HISTORIAL DE ABONOS");
  rowPointer += 1;

  prefacturaSheet.addRow(["Fecha", "Metodo", "Estado", "Monto", "Soporte"]);
  styleTableHeader(prefacturaSheet, rowPointer, 1, 5);
  rowPointer += 1;

  for (const payment of payments) {
    const row = prefacturaSheet.addRow([
      payment.createdAt ? formatDate(payment.createdAt) : "-",
      payment.method ?? "-",
      payment.status ?? "-",
      formatMoney(payment.amount ?? 0, currency),
      "",
    ]);
    applyRowBorder(prefacturaSheet, row.number, 1, 5);
    centerRowCells(prefacturaSheet, row.number, 1, 5);
    rowPointer = row.number + 1;

    if (payment.proofImageUrl) {
      const image = await fetchImageBuffer(payment.proofImageUrl);
      if (image) {
        const imageId = workbook.addImage({
          base64: imageBase64(
            image.buffer as NodeBuffer,
            image.extension as ImageExtension,
          ),
          extension: image.extension,
        });
        addImageToCell(prefacturaSheet, imageId, row.number, 5, 80);
      } else {
        setCenteredCellValue(row.getCell(5), "Imagen no disponible");
      }
    } else {
      setCenteredCellValue(row.getCell(5), "Imagen no disponible");
    }
  }

  const packagingByItem = new Map<string, typeof packaging>();
  for (const row of packaging) {
    if (!row.orderItemId) continue;
    const list = packagingByItem.get(row.orderItemId) ?? [];
    list.push(row);
    packagingByItem.set(row.orderItemId, list);
  }

  const socksByItem = new Map<string, typeof socks>();
  for (const row of socks) {
    if (!row.orderItemId) continue;
    const list = socksByItem.get(row.orderItemId) ?? [];
    list.push(row);
    socksByItem.set(row.orderItemId, list);
  }

  const materialsByItem = new Map<string, typeof materials>();
  for (const row of materials) {
    if (!row.orderItemId) continue;
    const list = materialsByItem.get(row.orderItemId) ?? [];
    list.push(row);
    materialsByItem.set(row.orderItemId, list);
  }

  const totalItems = items.length;

  for (const [index, item] of items.entries()) {
    const sheetName = `Diseño ${index + 1} de ${totalItems}`;
    const sheet = workbook.addWorksheet(sheetName);
    const sheetHeaderInfo = {
      ...headerInfo,
      subtitle: "Ficha de Diseño",
    };
    let sheetRow = applyDocumentHeader(sheet, sheetHeaderInfo, stickerImageId);
    sheetRow += 1;

    sheet.mergeCells(sheetRow, 1, sheetRow, 5);
    sheet.getCell(sheetRow, 1).value = "Detalle del Diseño";
    sheet.getCell(sheetRow, 1).font = { bold: true };
    applyRowBorder(sheet, sheetRow, 1, 5);
    sheetRow += 1;

    const detailRows: Array<[string, string, string?, string?]> = [
      ["Diseño", item.name ?? "-", "Estado", item.status ?? "-"],
      ["Cantidad", String(item.quantity ?? 0), "Proceso", item.process ?? "-"],
      ["Tela", item.fabric ?? "-", "Cuello", item.neckType ?? "-"],
      ["Manga", item.sleeve ?? "-", "Color", item.color ?? "-"],
      ["Genero", item.gender ?? "-", "Requiere medias", item.requiresSocks ? "Si" : "No"],
    ];

    for (const [leftLabel, leftValue, rightLabel, rightValue] of detailRows) {
      setLabelValue(sheet, sheetRow, 1, 2, leftLabel, leftValue ?? "-");
      if (rightLabel) {
        setLabelValue(sheet, sheetRow, 4, 5, rightLabel, rightValue ?? "-");
      }
      applyRowBorder(sheet, sheetRow, 1, 5);
      sheetRow += 1;
    }

    setLabelValue(sheet, sheetRow, 1, 2, "Imagen", "");
    sheet.mergeCells(sheetRow, 2, sheetRow, 5);
    applyRowBorder(sheet, sheetRow, 1, 5);

    const imageRow = sheet.getRow(sheetRow);
    if (imageRow) {
      if (item.imageUrl) {
        const image = await fetchImageBuffer(item.imageUrl);
        if (image) {
          const imageId = workbook.addImage({
            base64: imageBase64(
              image.buffer as NodeBuffer,
              image.extension as ImageExtension,
            ),
            extension: image.extension,
          });
          addImageToCell(sheet, imageId, imageRow.number, 2, 120);
        } else {
          imageRow.getCell(2).value = "Imagen no disponible";
        }
      } else {
        imageRow.getCell(2).value = "Imagen no disponible";
      }
    }

    sheetRow += 2;
    styleSectionTitle(sheet, sheetRow, 1, 5, "EMPAQUE");
    sheetRow += 1;
    sheet.addRow(["Modo", "Talla", "Cantidad", "Nombre", "Numero"]);
    styleTableHeader(sheet, sheetRow, 1, 5);
    sheetRow += 1;

    const itemPackaging = packagingByItem.get(item.id) ?? [];
    if (itemPackaging.length === 0) {
      const row = sheet.addRow(["-", "-", "-", "-", "-"]);
      applyRowBorder(sheet, row.number, 1, 5);
      centerRowCells(sheet, row.number, 1, 5);
      sheetRow = row.number + 1;
    } else {
      itemPackaging.forEach((p) => {
        const row = sheet.addRow([
          p.mode ?? "-",
          p.size ?? "-",
          p.quantity ?? 0,
          p.personName ?? "-",
          p.personNumber ?? "-",
        ]);
        applyRowBorder(sheet, row.number, 1, 5);
        centerRowCells(sheet, row.number, 1, 5);
        sheetRow = row.number + 1;
      });
    }

    sheetRow += 1;
    styleSectionTitle(sheet, sheetRow, 1, 5, "MEDIAS");
    sheetRow += 1;
    sheet.addRow(["Talla", "Cantidad", "Descripcion", "Imagen"]);
    styleTableHeader(sheet, sheetRow, 1, 4);
    sheetRow += 1;

    const itemSocks = socksByItem.get(item.id) ?? [];
    if (itemSocks.length === 0) {
      const row = sheet.addRow(["-", "-", "-", "-"]);
      applyRowBorder(sheet, row.number, 1, 4);
      centerRowCells(sheet, row.number, 1, 4);
      sheetRow = row.number + 1;
    } else {
      for (const sock of itemSocks) {
        const row = sheet.addRow([
          sock.size ?? "-",
          sock.quantity ?? 0,
          sock.description ?? "-",
          "",
        ]);
        applyRowBorder(sheet, row.number, 1, 4);
        centerRowCells(sheet, row.number, 1, 4);

        if (sock.imageUrl) {
          const image = await fetchImageBuffer(sock.imageUrl);
          if (image) {
            const imageId = workbook.addImage({
              base64: imageBase64(
                image.buffer as NodeBuffer,
                image.extension as ImageExtension,
              ),
              extension: image.extension,
            });
            addImageToCell(sheet, imageId, row.number, 4, 70);
          } else {
            setCenteredCellValue(row.getCell(4), "Imagen no disponible");
          }
        } else {
          setCenteredCellValue(row.getCell(4), "Imagen no disponible");
        }
        sheetRow = row.number + 1;
      }
    }

    sheetRow += 1;
    styleSectionTitle(sheet, sheetRow, 1, 5, "INSUMOS");
    sheetRow += 1;
    sheet.addRow(["Insumo", "Cantidad", "Nota"]);
    styleTableHeader(sheet, sheetRow, 1, 3);
    sheetRow += 1;

    const itemMaterials = materialsByItem.get(item.id) ?? [];
    if (itemMaterials.length === 0) {
      const row = sheet.addRow(["-", "-", "-"]);
      applyRowBorder(sheet, row.number, 1, 3);
      centerRowCells(sheet, row.number, 1, 3);
    } else {
      itemMaterials.forEach((m) => {
        const row = sheet.addRow([
          m.itemName ?? "-",
          m.quantity ?? "-",
          m.note ?? "",
        ]);
        applyRowBorder(sheet, row.number, 1, 3);
        centerRowCells(sheet, row.number, 1, 3);
      });
    }
  }

  const filename = `pedido-${orderRow.orderCode}.xlsx`;

  return workbookToXlsxResponse(workbook, filename);
}
