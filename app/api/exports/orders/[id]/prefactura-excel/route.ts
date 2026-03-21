import type { Buffer as NodeBuffer } from "node:buffer";

import { readFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";
import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  clients,
  employees,
  orderItemPackaging,
  orderItems,
  orderPayments,
  orders,
} from "@/src/db/schema";
import {
  getEmployeeIdFromRequest,
  getRoleFromRequest,
} from "@/src/utils/auth-middleware";
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
};

type ImageExtension = "png" | "jpeg";

function imageBase64(buffer: NodeBuffer, extension: ImageExtension) {
  const mime = extension === "png" ? "image/png" : "image/jpeg";

  return `data:${mime};base64,${buffer.toString("base64")}`;
}

function applyThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
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

function hasVisibleValue(value: unknown) {
  const text = String(value ?? "").trim();

  return text.length > 0 && text !== "-";
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

  worksheet.mergeCells(1, 1, 1, 7);
  worksheet.mergeCells(2, 1, 2, 7);

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

  const infoPairs: Array<{ label: string; value: string }> = [];
  const pushPair = (label: string, value: unknown) => {
    const safe = String(value ?? "").trim();

    if (!hasVisibleValue(safe)) return;
    infoPairs.push({ label, value: safe });
  };

  pushPair("Pedido", info.orderCode);
  pushPair("Fecha", info.orderDate);
  pushPair("Estado", info.orderStatus);
  pushPair("Tipo", info.orderType);
  pushPair("Kind", info.orderKind);
  pushPair("Moneda", info.currency);
  pushPair("Cliente", info.clientName);
  pushPair("NIT Cliente", info.clientNit);
  pushPair("NIT Empresa", info.companyNit);

  let rowPointer = 4;

  for (let index = 0; index < infoPairs.length; index += 2) {
    const leftPair = infoPairs[index];
    const rightPair = infoPairs[index + 1] ?? null;

    worksheet.getCell(rowPointer, 1).value = leftPair.label;
    worksheet.getCell(rowPointer, 1).font = { bold: true };

    if (rightPair) {
      worksheet.mergeCells(rowPointer, 2, rowPointer, 3);
      worksheet.getCell(rowPointer, 2).value = leftPair.value;

      worksheet.getCell(rowPointer, 4).value = rightPair.label;
      worksheet.getCell(rowPointer, 4).font = { bold: true };
      worksheet.mergeCells(rowPointer, 5, rowPointer, 7);
      worksheet.getCell(rowPointer, 5).value = rightPair.value;
    } else {
      worksheet.mergeCells(rowPointer, 2, rowPointer, 7);
      worksheet.getCell(rowPointer, 2).value = leftPair.value;
    }

    applyRowBorder(worksheet, rowPointer, 1, 7);
    rowPointer += 1;
  }

  const headerBottomRow = Math.max(3, rowPointer);

  for (let col = 1; col <= 7; col += 1) {
    for (let row = 1; row <= headerBottomRow; row += 1) {
      applyThinBorder(worksheet.getCell(row, col));
    }
  }

  if (stickerImageId) {
    worksheet.addImage(stickerImageId, {
      tl: { col: 5.15, row: 0.1 },
      ext: { width: 132, height: 64 },
    });
  }

  return headerBottomRow + 2;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, {
    key: "exports:prefactura:excel",
    limit: 120,
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
      createdBy: orders.createdBy,
      sellerName: employees.name,
      sellerSignatureImageUrl: employees.signatureImageUrl,
      sellerCompanyImageUrl: employees.companyImageUrl,
      clientName: clients.name,
      clientNit: clients.identification,
      type: orders.type,
      status: orders.status,
      currency: orders.currency,
      discount: orders.discount,
      shippingFee: (orders as any).shippingFee,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .leftJoin(employees, eq(orders.createdBy, employees.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!orderRow) return new Response("Not found", { status: 404 });

  const role = getRoleFromRequest(request);
  const employeeId = getEmployeeIdFromRequest(request);

  if (role === "ASESOR" && (!employeeId || orderRow.createdBy !== employeeId)) {
    return new Response("Forbidden", { status: 403 });
  }

  const lines = await db
    .select({
      id: orderItems.id,
      name: orderItems.name,
      garmentType: orderItems.garmentType,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      totalPrice: orderItems.totalPrice,
      imageUrl: orderItems.imageUrl,
      clothingImageOneUrl: orderItems.clothingImageOneUrl,
      clothingImageTwoUrl: orderItems.clothingImageTwoUrl,
      logoImageUrl: orderItems.logoImageUrl,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const lineIds = lines.map((line) => line.id).filter(Boolean);

  const packaging = lineIds.length
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
        .where(inArray(orderItemPackaging.orderItemId, lineIds as any))
    : [];

  const subtotal = lines.reduce((acc, l) => {
    const qty = Number(l.quantity ?? 0);
    const unit = asNumber(l.unitPrice);
    const lineTotal =
      l.totalPrice !== null && l.totalPrice !== undefined
        ? asNumber(l.totalPrice)
        : unit * qty;

    return acc + lineTotal;
  }, 0);

  const rawSubtotal = lines.reduce((acc, l) => {
    const qty = Number(l.quantity ?? 0);
    const unit = asNumber(l.unitPrice);

    return acc + unit * qty;
  }, 0);

  const discountAmount = Math.max(0, rawSubtotal - subtotal);
  const discountPercent =
    rawSubtotal > 0
      ? Math.min(100, Math.max(0, (discountAmount / rawSubtotal) * 100))
      : 0;
  const totalAfterDiscount = subtotal;
  const shippingFee = Math.max(0, asNumber(orderRow.shippingFee));
  const grandTotal = totalAfterDiscount + shippingFee;

  const [paidRow] = await db
    .select({
      paidTotal: sql<string>`coalesce(sum(${orderPayments.amount}), 0)::text`,
    })
    .from(orderPayments)
    .where(
      sql`${orderPayments.orderId} = ${orderId} and ${orderPayments.status} = 'PAGADO'`,
    )
    .limit(1);

  const paidTotal = Math.max(0, asNumber(paidRow?.paidTotal));
  const remaining = Math.max(0, grandTotal - paidTotal);

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

  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME ?? "VIOMAR";
  const companyNit = process.env.NEXT_PUBLIC_COMPANY_NIT ?? "-";
  const currency = String(orderRow.currency ?? "COP").toUpperCase();
  const orderDate = orderRow.createdAt ? formatDate(orderRow.createdAt) : "-";

  const workbook = new ExcelJS.Workbook();

  workbook.creator = companyName;
  workbook.created = new Date();

  const companyImage = orderRow.sellerCompanyImageUrl
    ? await fetchImageBuffer(String(orderRow.sellerCompanyImageUrl))
    : null;

  const companyFallbackPath = path.join(process.cwd(), "public", "image.png");
  const companyFallbackBuffer = await readFile(companyFallbackPath).catch(
    () => null,
  );

  const stickerPath = path.join(process.cwd(), "public", "STICKER VIOMAR.png");
  const stickerBuffer = await readFile(stickerPath).catch(() => null);

  const stickerImageId = companyImage
    ? workbook.addImage({
        base64: imageBase64(
          companyImage.buffer as NodeBuffer,
          companyImage.extension as ImageExtension,
        ),
        extension: companyImage.extension,
      })
    : companyFallbackBuffer
      ? workbook.addImage({
          base64: imageBase64(companyFallbackBuffer as NodeBuffer, "png"),
          extension: "png",
        })
      : stickerBuffer
        ? workbook.addImage({
            base64: imageBase64(stickerBuffer as NodeBuffer, "png"),
            extension: "png",
          })
        : undefined;

  const signatureImage = orderRow.sellerSignatureImageUrl
    ? await fetchImageBuffer(String(orderRow.sellerSignatureImageUrl))
    : null;

  const signatureImageId = signatureImage
    ? workbook.addImage({
        base64: imageBase64(
          signatureImage.buffer as NodeBuffer,
          signatureImage.extension as ImageExtension,
        ),
        extension: signatureImage.extension,
      })
    : undefined;

  const headerInfo: HeaderInfo = {
    companyName,
    companyNit,
    subtitle: "Prefactura",
    orderCode: orderRow.orderCode ?? "-",
    orderStatus: orderRow.status ?? "-",
    orderType: orderRow.type ?? "-",
    orderKind: "-",
    currency,
    orderDate,
    clientName: orderRow.clientName ?? "-",
    clientNit: orderRow.clientNit ?? "-",
  };

  const sheet = workbook.addWorksheet("Prefactura");

  sheet.getColumn(1).width = 24;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 12;
  sheet.getColumn(4).width = 16;
  sheet.getColumn(5).width = 16;
  sheet.getColumn(6).width = 16;
  sheet.getColumn(7).width = 16;

  let rowPointer = applyDocumentHeader(sheet, headerInfo, stickerImageId);

  rowPointer += 1;
  styleSectionTitle(sheet, rowPointer, 1, 7, "DETALLE DE PRODUCTOS");
  rowPointer += 1;

  sheet.addRow([
    "Diseño",
    "Tipo",
    "Cantidad",
    "Unitario",
    "Total",
    "Prenda 1",
    "Logo",
  ]);
  styleTableHeader(sheet, rowPointer, 1, 7);
  rowPointer += 1;

  for (const line of lines) {
    const row = sheet.addRow([
      line.name ?? "-",
      line.garmentType ?? "JUGADOR",
      line.quantity ?? 0,
      formatMoney(line.unitPrice ?? 0, currency),
      formatMoney(line.totalPrice ?? 0, currency),
      "",
      "",
    ]);

    applyRowBorder(sheet, row.number, 1, 7);
    centerRowCells(sheet, row.number, 1, 7);
    rowPointer = row.number + 1;

    const imageOneSource = line.clothingImageOneUrl ?? line.imageUrl;

    if (imageOneSource) {
      const image = await fetchImageBuffer(imageOneSource);

      if (image) {
        const imageId = workbook.addImage({
          base64: imageBase64(
            image.buffer as NodeBuffer,
            image.extension as ImageExtension,
          ),
          extension: image.extension,
        });

        addImageToCell(sheet, imageId, row.number, 6, 70);
      } else {
        setCenteredCellValue(row.getCell(6), "Imagen no disponible");
      }
    } else {
      setCenteredCellValue(row.getCell(6), "Imagen no disponible");
    }

    if (line.logoImageUrl) {
      const image = await fetchImageBuffer(line.logoImageUrl);

      if (image) {
        const imageId = workbook.addImage({
          base64: imageBase64(
            image.buffer as NodeBuffer,
            image.extension as ImageExtension,
          ),
          extension: image.extension,
        });

        addImageToCell(sheet, imageId, row.number, 7, 70);
      } else {
        setCenteredCellValue(row.getCell(7), "Imagen no disponible");
      }
    } else {
      setCenteredCellValue(row.getCell(7), "Imagen no disponible");
    }
  }

  const lineNameById = new Map(
    lines.map((line) => [line.id, line.name ?? "-"]),
  );
  const packagingRows = packaging.filter((row) => {
    const name = String(row.personName ?? "").trim();
    const number = String(row.personNumber ?? "").trim();
    const size = String(row.size ?? "").trim();
    const quantity = Math.max(0, Math.floor(asNumber(row.quantity)));

    return Boolean(name || number || size || quantity > 0);
  });

  rowPointer += 1;
  styleSectionTitle(sheet, rowPointer, 1, 7, "LISTA DE EMPAQUE");
  rowPointer += 1;

  sheet.addRow(["Diseño", "Número", "Nombre", "Talla", "Cantidad", "", ""]);
  styleTableHeader(sheet, rowPointer, 1, 7);
  rowPointer += 1;

  if (packagingRows.length === 0) {
    const row = sheet.addRow(["-", "-", "-", "-", 0, "", ""]);

    applyRowBorder(sheet, row.number, 1, 7);
    centerRowCells(sheet, row.number, 1, 7);
    rowPointer = row.number + 1;
  } else {
    for (const rowData of packagingRows) {
      const row = sheet.addRow([
        lineNameById.get(String(rowData.orderItemId)) ?? "-",
        rowData.personNumber ?? "-",
        rowData.personName ?? "-",
        rowData.size ?? "-",
        Math.max(0, Math.floor(asNumber(rowData.quantity))),
        "",
        "",
      ]);

      applyRowBorder(sheet, row.number, 1, 7);
      centerRowCells(sheet, row.number, 1, 7);
      rowPointer = row.number + 1;
    }
  }

  rowPointer += 1;
  styleSectionTitle(sheet, rowPointer, 1, 7, "RESUMEN FINANCIERO");
  rowPointer += 1;

  const resumenRows = [
    ["Subtotal", formatMoney(subtotal, currency)],
    ["Descuento %", String(discountPercent)],
    ["Descuento", formatMoney(discountAmount, currency)],
    ["Flete", formatMoney(shippingFee, currency)],
    ["Total", formatMoney(grandTotal, currency)],
    ["Abonado", formatMoney(paidTotal, currency)],
    ["Saldo", formatMoney(remaining, currency)],
  ];

  for (const [label, value] of resumenRows) {
    sheet.getCell(rowPointer, 1).value = label;
    sheet.getCell(rowPointer, 1).font = { bold: true };
    sheet.getCell(rowPointer, 2).value = value;
    sheet.mergeCells(rowPointer, 2, rowPointer, 7);
    sheet.getCell(rowPointer, 2).alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    applyRowBorder(sheet, rowPointer, 1, 7);
    rowPointer += 1;
  }

  rowPointer += 1;
  styleSectionTitle(sheet, rowPointer, 1, 7, "HISTORIAL DE ABONOS");
  rowPointer += 1;

  sheet.addRow(["Fecha", "Metodo", "Estado", "Monto", "Soporte", "", ""]);
  styleTableHeader(sheet, rowPointer, 1, 7);
  rowPointer += 1;

  for (const payment of payments) {
    const row = sheet.addRow([
      payment.createdAt ? formatDate(payment.createdAt) : "-",
      payment.method ?? "-",
      payment.status ?? "-",
      formatMoney(payment.amount ?? 0, currency),
      "",
      "",
      "",
    ]);

    applyRowBorder(sheet, row.number, 1, 7);
    centerRowCells(sheet, row.number, 1, 7);
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

        addImageToCell(sheet, imageId, row.number, 5, 70);
      } else {
        setCenteredCellValue(row.getCell(5), "Imagen no disponible");
      }
    } else {
      setCenteredCellValue(row.getCell(5), "Imagen no disponible");
    }
  }

  rowPointer += 1;
  styleSectionTitle(sheet, rowPointer, 1, 7, "FIRMA Y APROBACIÓN");
  rowPointer += 1;

  sheet.mergeCells(rowPointer, 1, rowPointer, 3);
  sheet.mergeCells(rowPointer, 4, rowPointer, 7);
  sheet.getCell(rowPointer, 1).value = "Asesor";
  sheet.getCell(rowPointer, 1).font = { bold: true };
  sheet.getCell(rowPointer, 4).value = orderRow.sellerName ?? "-";
  applyRowBorder(sheet, rowPointer, 1, 7);
  rowPointer += 1;

  sheet.mergeCells(rowPointer, 1, rowPointer, 7);
  sheet.getCell(rowPointer, 1).value = "Firma autorizada";
  sheet.getCell(rowPointer, 1).font = { bold: true };
  sheet.getCell(rowPointer, 1).alignment = {
    vertical: "middle",
    horizontal: "center",
  };
  applyRowBorder(sheet, rowPointer, 1, 7);

  if (signatureImageId) {
    sheet.getRow(rowPointer).height = Math.max(
      sheet.getRow(rowPointer).height ?? 15,
      95,
    );
    sheet.addImage(signatureImageId, {
      tl: { col: 1.2, row: rowPointer - 1 + 0.05 },
      ext: { width: 400, height: 90 },
    });
  }

  const filename = `prefactura-${orderRow.orderCode}.xlsx`;

  return workbookToXlsxResponse(workbook, filename);
}
