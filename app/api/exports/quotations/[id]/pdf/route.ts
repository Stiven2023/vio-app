import { eq, inArray, sql } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { db } from "@/src/db";
import {
  additions,
  clients,
  employees,
  quotationItemAdditions,
  quotationItems,
  quotations,
  users,
} from "@/src/db/schema";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

function asNumber(value: unknown) {
  const n = Number(String(value ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: unknown, currency: string) {
  const cur = currency === "USD" ? "USD" : "COP";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: cur,
    minimumFractionDigits: cur === "USD" ? 2 : 0,
    maximumFractionDigits: cur === "USD" ? 2 : 0,
  }).format(asNumber(value));
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CO").format(d);
}

function truncateText(value: unknown, max = 42) {
  const text = String(value ?? "-");
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 3))}...`;
}

function sanitizeWinAnsi(value: unknown) {
  return String(value ?? "")
    .replace(/[^\u0020-\u00FF]/g, "-");
}

async function readImageSourceBytes(source: string): Promise<Uint8Array | null> {
  const value = String(source ?? "").trim();
  if (!value) return null;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    const response = await fetch(value);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  const normalized = value.startsWith("/")
    ? value.slice(1)
    : value;
  const diskPath = join(process.cwd(), "public", normalized);
  const bytes = await readFile(diskPath);
  return new Uint8Array(bytes);
}

async function embedImageFromSource(
  pdf: PDFDocument,
  source: string,
): Promise<Awaited<ReturnType<PDFDocument["embedPng"]>> | null> {
  const bytes = await readImageSourceBytes(source);
  if (!bytes) return null;

  try {
    return await pdf.embedPng(bytes);
  } catch {
    try {
      return await pdf.embedJpg(bytes);
    } catch {
      return null;
    }
  }
}

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const params = await props.params;
  const { searchParams } = new URL(request.url);
  const audienceParam = String(searchParams.get("audience") ?? "interno").toLowerCase();
  const isExternalPdf = audienceParam === "externo" || audienceParam === "external";

  const limited = rateLimit(request, {
    key: "quotations:export:pdf",
    limit: 60,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "DESCARGAR_COTIZACION");
  if (forbidden) return forbidden;

  const quotationId = String(params.id ?? "").trim();
  if (!quotationId) return new Response("id required", { status: 400 });

  const [header] = await db
    .select({
      id: quotations.id,
      quoteCode: quotations.quoteCode,
      currency: quotations.currency,
      documentType: quotations.documentType,
      promissoryNoteNumber: quotations.promissoryNoteNumber,
      deliveryDate: quotations.deliveryDate,
      expiryDate: quotations.expiryDate,
      paymentTerms: quotations.paymentTerms,
      totalProducts: quotations.totalProducts,
      subtotal: quotations.subtotal,
      iva: quotations.iva,
      shippingEnabled: quotations.shippingEnabled,
      shippingFee: quotations.shippingFee,
      insuranceEnabled: quotations.insuranceEnabled,
      insuranceFee: quotations.insuranceFee,
      total: quotations.total,
      advancePayment: quotations.advancePayment,
      prefacturaApproved: quotations.prefacturaApproved,
      prefacturaCode: sql<string | null>`(
        select p.prefactura_code from prefacturas p where p.quotation_id = ${quotations.id} limit 1
      )`,
      clientCode: clients.clientCode,
      clientName: clients.name,
      clientEmail: clients.email,
      clientIdentification: clients.identification,
      clientDv: clients.dv,
      clientContactName: clients.contactName,
      clientContactPhone: sql<string>`coalesce(${clients.fullMobile}, ${clients.mobile}, ${clients.landline})`,
      clientAddress: clients.address,
      clientCountry: clients.country,
      clientCity: clients.city,
      clientPostalCode: clients.postalCode,
      sellerName: sql<string>`coalesce(${employees.name}, ${users.email})`,
      sellerSignatureImageUrl: employees.signatureImageUrl,
      sellerCompanyImageUrl: employees.companyImageUrl,
    })
    .from(quotations)
    .leftJoin(clients, eq(quotations.clientId, clients.id))
    .leftJoin(users, eq(quotations.sellerId, users.id))
    .leftJoin(employees, eq(employees.userId, users.id))
    .where(eq(quotations.id, quotationId))
    .limit(1);

  if (!header) return new Response("Cotización no encontrada", { status: 404 });

  const items = await db
    .select({
      id: quotationItems.id,
      orderType: quotationItems.orderType,
      negotiation: quotationItems.negotiation,
      quantity: quotationItems.quantity,
      unitPrice: quotationItems.unitPrice,
      discount: quotationItems.discount,
      orderCodeReference: quotationItems.orderCodeReference,
      designNumber: quotationItems.designNumber,
      productName: sql<string>`(
        select p.name from products p where p.id = ${quotationItems.productId}
      )`,
      productCode: sql<string>`(
        select p.product_code from products p where p.id = ${quotationItems.productId}
      )`,
    })
    .from(quotationItems)
    .where(eq(quotationItems.quotationId, quotationId));

  const itemIds = items.map((item) => item.id);

  const itemAdditions = itemIds.length
    ? await db
        .select({
          quotationItemId: quotationItemAdditions.quotationItemId,
          quantity: quotationItemAdditions.quantity,
          unitPrice: quotationItemAdditions.unitPrice,
          additionCode: additions.additionCode,
          additionName: additions.name,
        })
        .from(quotationItemAdditions)
        .leftJoin(additions, eq(quotationItemAdditions.additionId, additions.id))
        .where(inArray(quotationItemAdditions.quotationItemId, itemIds))
    : [];

  const additionsByItem = new Map<string, typeof itemAdditions>();
  for (const add of itemAdditions) {
    const key = String(add.quotationItemId);
    const current = additionsByItem.get(key) ?? [];
    current.push(add);
    additionsByItem.set(key, current);
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const headerImage =
    (await embedImageFromSource(pdf, String(header.sellerCompanyImageUrl ?? ""))) ||
    (await embedImageFromSource(pdf, "/image.png"));
  const footerSignatureImage = await embedImageFromSource(
    pdf,
    String(header.sellerSignatureImageUrl ?? ""),
  );

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 30;
  const contentWidth = pageWidth - margin * 2;
  const footerFullWidth = pageWidth;
  const estimatedFooterHeight = footerSignatureImage
    ? Math.max(56, footerSignatureImage.height * (footerFullWidth / footerSignatureImage.width))
    : 0;
  const bottomLimit = 24 + estimatedFooterHeight + 18;
  const textColor = rgb(0.12, 0.12, 0.15);
  const mutedColor = rgb(0.4, 0.42, 0.48);
  const lineColor = rgb(0.84, 0.86, 0.9);
  const headerBg = rgb(0.94, 0.96, 0.99);

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  let pageNumber = 1;

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    size = 10,
    isBold = false,
    color = textColor,
  ) => {
    const safeText = sanitizeWinAnsi(text);
    page.drawText(safeText, {
      x,
      y: yPos,
      size,
      font: isBold ? bold : font,
      color,
    });
  };

  const drawCellText = (
    text: string,
    x: number,
    yPos: number,
    width: number,
    size = 8.5,
    isBold = false,
  ) => {
    const safe = truncateText(text, Math.max(4, Math.floor(width / 5.7)));
    drawText(safe, x + 4, yPos, size, isBold);
  };

  const addPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    pageNumber += 1;
    y = pageHeight - margin;
  };

  const drawFooter = () => {
    if (footerSignatureImage) {
      const signatureWidth = footerFullWidth;
      const ratio = signatureWidth / footerSignatureImage.width;
      const signatureHeight = Math.max(56, footerSignatureImage.height * ratio);
      const signatureX = 0;
      const signatureY = 0;

      page.drawImage(footerSignatureImage, {
        x: signatureX,
        y: signatureY,
        width: signatureWidth,
        height: signatureHeight,
      });
    }

    drawText(
      `Documento generado automáticamente por Viomar · Página ${pageNumber}`,
      margin,
      10,
      8,
      false,
      mutedColor,
    );
  };

  const drawHeader = (isFirstPage: boolean) => {
    let headerHeight = 56;

    if (headerImage) {
      const logoWidth = Math.min(280, contentWidth);
      const ratio = logoWidth / headerImage.width;
      const logoHeight = Math.max(62, headerImage.height * ratio);
      const logoX = (pageWidth - logoWidth) / 2;
      const logoTopY = y;

      page.drawImage(headerImage, {
        x: logoX,
        y: logoTopY - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });

      headerHeight = Math.max(headerHeight, logoHeight + 8);
    } else {
      headerHeight = Math.max(headerHeight, 30);
    }

    y -= isFirstPage ? headerHeight + 10 : Math.max(52, headerHeight);
  };

  const drawGeneralGrid = () => {
    const boxTop = y;
    const rowH = 24;
    const cols = 2;
    const colW = contentWidth / cols;
    const nitWithDv = `${header.clientIdentification ?? "-"}${header.clientDv ? `-${header.clientDv}` : ""}`;
    const emissionDate = formatDate(new Date());
    const paymentTermsNormalized = String(header.paymentTerms ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase();
    const isCreditPayment = paymentTermsNormalized === "CREDITO";

    const isPresentValue = (value: unknown) => {
      const text = String(value ?? "").trim();
      return text.length > 0 && text !== "-";
    };

    const infoPairs: Array<{ label: string; value: string }> = [];
    const pushPair = (label: string, value: unknown) => {
      const safeValue = String(value ?? "").trim();
      if (!isPresentValue(safeValue)) return;
      infoPairs.push({ label, value: safeValue });
    };

    pushPair("Codigo Cotizacion", String(header.quoteCode ?? "-"));
    pushPair("Fecha Emision", emissionDate);
    pushPair("Cliente", String(header.clientName ?? "-"));
    pushPair("Codigo Cliente", String(header.clientCode ?? "-"));

    if (!isExternalPdf) {
      pushPair("NIT / CC", nitWithDv);
      pushPair("Email", String(header.clientEmail ?? "-"));
    } else {
      pushPair("Email", String(header.clientEmail ?? "-"));
      pushPair("Ciudad", String(header.clientCity ?? "-"));
    }

    pushPair("Nombre Contacto", String(header.clientContactName ?? "-"));
    pushPair("Numero Contacto", String(header.clientContactPhone ?? "-"));
    pushPair("Moneda", String(header.currency ?? "COP"));

    if (!isExternalPdf) {
      pushPair("Tipo Documento", String(header.documentType ?? "F"));
    }

    pushPair("Entrega", formatDate(header.deliveryDate));
    pushPair("Vencimiento", formatDate(header.expiryDate));
    pushPair("Condición Pago", String(header.paymentTerms ?? "-"));
    pushPair("Vendedor", String(header.sellerName ?? "-"));

    if (isCreditPayment) {
      pushPair("N° Pagaré", String(header.promissoryNoteNumber ?? "-"));
      pushPair("Ciudad", String(header.clientCity ?? "-"));
    }

    pushPair(
      "Estado Prefactura",
      header.prefacturaApproved
        ? `APROBADA ${header.prefacturaCode ? `(${header.prefacturaCode})` : ""}`
        : "NO",
    );

    const groupedRows: Array<
      [{ label: string; value: string }, { label: string; value: string } | null]
    > = [];

    for (let index = 0; index < infoPairs.length; index += 2) {
      groupedRows.push([infoPairs[index], infoPairs[index + 1] ?? null]);
    }

    groupedRows.forEach((row, idx) => {
      const rowY = boxTop - idx * rowH;
      page.drawRectangle({
        x: margin,
        y: rowY - rowH,
        width: contentWidth,
        height: rowH,
        borderColor: lineColor,
        borderWidth: 1,
        color: rgb(1, 1, 1),
      });

      const [leftPair, rightPair] = row;

      if (rightPair) {
        page.drawLine({
          start: { x: margin + colW, y: rowY },
          end: { x: margin + colW, y: rowY - rowH },
          color: lineColor,
          thickness: 1,
        });
      }

      drawText(leftPair.label, margin + 6, rowY - 9, 8, false, mutedColor);
      drawText(truncateText(leftPair.value, rightPair ? 28 : 70), margin + 6, rowY - 19, 9, true);

      if (rightPair) {
        drawText(rightPair.label, margin + colW + 6, rowY - 9, 8, false, mutedColor);
        drawText(truncateText(rightPair.value, 28), margin + colW + 6, rowY - 19, 9, true);
      }
    });

    y = boxTop - groupedRows.length * rowH - 12;
  };

  const tableX = margin;
  const tableHeaderH = 22;
  const tableRowH = 18;
  const columns = [
    { label: "Codigo", width: 58 },
    { label: "Detalle", width: 188 },
    { label: "Cant.", width: 46 },
    { label: "V. Unitario", width: 88 },
    { label: "Desc%", width: 52 },
    { label: "Total", width: contentWidth - (58 + 188 + 46 + 88 + 52) },
  ] as const;

  const drawTableHeader = () => {
    page.drawRectangle({
      x: tableX,
      y: y - tableHeaderH,
      width: contentWidth,
      height: tableHeaderH,
      color: headerBg,
      borderColor: lineColor,
      borderWidth: 1,
    });

    let x = tableX;
    columns.forEach((col) => {
      drawText(col.label, x + 4, y - 14, 8.5, true);
      x += col.width;
      page.drawLine({
        start: { x, y },
        end: { x, y: y - tableHeaderH },
        color: lineColor,
        thickness: 1,
      });
    });

    y -= tableHeaderH;
  };

  type PdfRow = {
    code: string;
    detail: string;
    qty: string;
    unit: string;
    discount: string;
    total: string;
    isSubRow?: boolean;
  };

  const rows: PdfRow[] = [];
  for (const item of items) {
    const qty = asNumber(item.quantity);
    const unitPrice = asNumber(item.unitPrice);
    const discount = asNumber(item.discount);
    const subtotal = qty * unitPrice;
    const totalLine = subtotal - subtotal * (discount / 100);

    rows.push({
      code: String(item.productCode ?? "-"),
      detail: String(item.productName ?? "Producto"),
      qty: String(qty),
      unit: formatMoney(unitPrice, String(header.currency ?? "COP")),
      discount: `${discount}%`,
      total: formatMoney(totalLine, String(header.currency ?? "COP")),
    });

    if (item.orderCodeReference || item.designNumber) {
      rows.push({
        code: "",
        detail: `Referencia: ${item.orderCodeReference ?? "-"} / Diseño: ${item.designNumber ?? "-"}`,
        qty: "",
        unit: "",
        discount: "",
        total: "",
        isSubRow: true,
      });
    }

    const adds = additionsByItem.get(item.id) ?? [];
    for (const add of adds) {
      const addQty = asNumber(add.quantity);
      const addUnit = asNumber(add.unitPrice);
      rows.push({
        code: String(add.additionCode ?? "-"),
        detail: `- Adicion: ${add.additionName ?? "Adicion"}`,
        qty: String(addQty),
        unit: formatMoney(addUnit, String(header.currency ?? "COP")),
        discount: "0%",
        total: formatMoney(addQty * addUnit, String(header.currency ?? "COP")),
        isSubRow: true,
      });
    }
  }

  drawHeader(true);
  drawGeneralGrid();
  drawTableHeader();

  for (const row of rows) {
    if (y - tableRowH < bottomLimit + 120) {
      drawFooter();
      addPage();
      drawHeader(false);
      drawTableHeader();
    }

    page.drawRectangle({
      x: tableX,
      y: y - tableRowH,
      width: contentWidth,
      height: tableRowH,
      borderColor: lineColor,
      borderWidth: 1,
      color: rgb(1, 1, 1),
    });

    let x = tableX;
    const values = [row.code, row.detail, row.qty, row.unit, row.discount, row.total];
    values.forEach((value, idx) => {
      const width = columns[idx].width;
      drawCellText(String(value), x, y - 12, width, 8.2, !row.isSubRow && idx === 1);
      x += width;
      page.drawLine({
        start: { x, y },
        end: { x, y: y - tableRowH },
        color: lineColor,
        thickness: 1,
      });
    });

    y -= tableRowH;
  }

  const summaryRows: Array<[string, string]> = [
    ["Total Productos", formatMoney(header.totalProducts, String(header.currency ?? "COP"))],
    ["Subtotal", formatMoney(header.subtotal, String(header.currency ?? "COP"))],
    [
      header.documentType === "R" ? "IVA" : "IVA (19%)",
      header.documentType === "R"
        ? "Sin IVA"
        : formatMoney(header.iva, String(header.currency ?? "COP")),
    ],
    [
      "Envío",
      header.shippingEnabled
        ? formatMoney(header.shippingFee, String(header.currency ?? "COP"))
        : "No aplica",
    ],
    [
      "Seguro",
      header.insuranceEnabled
        ? formatMoney(header.insuranceFee, String(header.currency ?? "COP"))
        : "No aplica",
    ],
    ["Total General", formatMoney(header.total, String(header.currency ?? "COP"))],
  ];

  const summaryRowH = 18;
  const summaryWidth = 220;
  const summaryHeight = summaryRows.length * summaryRowH + 16;
  const anticipoHeight = 32;
  const requiredSpace = summaryHeight + anticipoHeight + 24;

  if (y - requiredSpace < bottomLimit) {
    drawFooter();
    addPage();
    drawHeader(false);
  }

  const summaryX = pageWidth - margin - summaryWidth;
  const summaryY = y - 10;
  page.drawRectangle({
    x: summaryX,
    y: summaryY - summaryHeight,
    width: summaryWidth,
    height: summaryHeight,
    borderColor: lineColor,
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  drawText("RESUMEN", summaryX + 8, summaryY - 12, 9, true);

  summaryRows.forEach(([label, value], idx) => {
    const rowY = summaryY - 28 - idx * summaryRowH;
    const isTotal = label === "Total General";
    drawText(label, summaryX + 8, rowY, 8.8, isTotal);
    drawText(value, summaryX + 108, rowY, 8.8, isTotal);
  });

  const anticipoY = summaryY - summaryHeight - 10;
  page.drawRectangle({
    x: summaryX,
    y: anticipoY - anticipoHeight,
    width: summaryWidth,
    height: anticipoHeight,
    borderColor: lineColor,
    borderWidth: 1,
    color: headerBg,
  });
  drawText("ANTICIPO (50%)", summaryX + 8, anticipoY - 13, 9.5, true);
  drawText(
    formatMoney(header.advancePayment, String(header.currency ?? "COP")),
    summaryX + 108,
    anticipoY - 13,
    10,
    true,
  );

  drawFooter();

  const pdfBytes = await pdf.save();
  const normalizedBytes = Uint8Array.from(pdfBytes);
  const body = new Blob([normalizedBytes.buffer], { type: "application/pdf" });

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${String(header.quoteCode ?? "cot").toLowerCase()}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
