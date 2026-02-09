import ExcelJS from "exceljs";
import type { Buffer as NodeBuffer } from "node:buffer";

type ImageExtension = "png" | "jpeg";

const IMAGE_TYPES: Record<string, ImageExtension> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/webp": "png",
};

function guessImageType(url: string, contentType?: string | null) {
  if (contentType && IMAGE_TYPES[contentType]) return IMAGE_TYPES[contentType];

  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpeg";
  if (lower.endsWith(".webp")) return "png";

  return null;
}

export async function fetchImageBuffer(
  url: string,
): Promise<{ buffer: NodeBuffer; extension: ImageExtension } | null> {
  if (!url) return null;

  try {
    const response = await fetch(url);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type");
    const extension = guessImageType(url, contentType);

    if (!extension) return null;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer) as NodeBuffer;

    return { buffer, extension };
  } catch {
    return null;
  }
}

export async function workbookToXlsxResponse(
  workbook: ExcelJS.Workbook,
  filename: string,
) {
  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function addImageToCell(
  worksheet: ExcelJS.Worksheet,
  imageId: number,
  rowNumber: number,
  colNumber: number,
  size = 80,
) {
  worksheet.getRow(rowNumber).height = Math.max(
    worksheet.getRow(rowNumber).height ?? 15,
    size * 0.75,
  );

  worksheet.addImage(imageId, {
    tl: { col: colNumber - 1, row: rowNumber - 1 },
    ext: { width: size, height: size },
  });
}
