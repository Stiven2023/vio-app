import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { categories, products } from "@/src/db/schema";
import { getLatestUsdCopRate } from "@/src/utils/exchange-rate";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type ImportRow = {
  categoryId?: string;
  productCode?: string;
  name?: string;
  description?: string;
  priceCopBase?: string;
  priceCopR1?: string;
  priceCopR2?: string;
  priceCopR3?: string;
  priceMayorista?: string;
  priceColanta?: string;
  priceCopInternational?: string;
  priceUSD?: string;
  trmUsed?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  isActive?: string;
};

function normalizeHeader(value: string) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function detectDelimiter(headerLine: string) {
  const delimiters = [";", ",", "\t"];
  let selected = ",";
  let bestCount = -1;

  for (const delimiter of delimiters) {
    const count = headerLine.split(delimiter).length;
    if (count > bestCount) {
      bestCount = count;
      selected = delimiter;
    }
  }

  return selected;
}

function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsv(content: string): ImportRow[] {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = parseCsvLine(lines[0], delimiter);
  const headers = rawHeaders.map(normalizeHeader);

  const getCell = (cells: string[], aliases: string[]) => {
    const aliasSet = aliases.map(normalizeHeader);
    const index = headers.findIndex((h) => aliasSet.includes(h));
    return index >= 0 ? String(cells[index] ?? "").trim() : "";
  };

  const rows: ImportRow[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const cells = parseCsvLine(lines[lineIndex], delimiter);

    const row: ImportRow = {
      categoryId: getCell(cells, ["categoryId", "categoriaId", "idCategoria"]),
      productCode: getCell(cells, ["productCode", "codigoProducto"]),
      name: getCell(cells, ["name", "nombre", "nombreProducto", "producto"]),
      description: getCell(cells, ["description", "descripcion", "detalle"]),
      priceCopBase: getCell(cells, ["priceCopBase", "precioBase", "preciocopbase"]),
      priceCopR1: getCell(cells, ["priceCopR1", "precioR1", "precio1499", "precio1499cop", "precio1499cop"]),
      priceCopR2: getCell(cells, ["priceCopR2", "precioR2", "precio5001000", "precio5001000cop"]),
      priceCopR3: getCell(cells, ["priceCopR3", "precioR3", "precio1001", "precio1001cop"]),
      priceMayorista: getCell(cells, ["priceMayorista", "precioMayorista"]),
      priceColanta: getCell(cells, ["priceColanta", "precioColanta"]),
      priceCopInternational: getCell(cells, ["priceCopInternational", "precioCopInternacional"]),
      priceUSD: getCell(cells, ["priceUSD", "precioUsd"]),
      trmUsed: getCell(cells, ["trmUsed", "trm"]),
      startDate: getCell(cells, ["startDate", "fechaInicio", "fechainicioyyyy-mm-dd"]),
      endDate: getCell(cells, ["endDate", "fechaFin", "fechafinyyyy-mm-dd"]),
      createdAt: getCell(cells, ["createdAt", "creado"]),
      isActive: getCell(cells, ["isActive", "activo"]),
    };

    if (!row.name && !row.categoryId) continue;
    rows.push(row);
  }

  return rows;
}

function normalizeProductCodePrefix(categoryName: string) {
  const cleaned = String(categoryName)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return cleaned.slice(0, 3).padEnd(3, "X");
}

async function buildNextProductCodeTx(tx: any, categoryId: string) {
  const [category] = await tx
    .select({ name: categories.name })
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);

  if (!category) {
    throw new Error("Categoría inválida");
  }

  const prefix = normalizeProductCodePrefix(category.name);

  const [row] = await tx
    .select({
      maxSuffix: sql<number>`max(nullif(substring(${products.productCode}, 4, 2), '')::int)`,
    })
    .from(products)
    .where(sql`${products.productCode} like ${prefix + "%"}`);

  const nextSuffix = (row?.maxSuffix ?? 0) + 1;

  if (nextSuffix > 99) {
    throw new Error(`Se alcanzó el máximo de códigos para la categoría ${category.name}`);
  }

  return `${prefix}${String(nextSuffix).padStart(2, "0")}`;
}

async function resolveCategoryIdFromRow(row: ImportRow) {
  const categoryIdRaw = String(row.categoryId ?? "").trim();

  if (categoryIdRaw) {
    const [existingById] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryIdRaw))
      .limit(1);

    if (!existingById?.id) {
      throw new Error(`categoryId inválido: ${categoryIdRaw}`);
    }

    return existingById.id;
  }

  throw new Error("categoryId requerido");
}

function asNumber(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function toOptionalDate(value: string | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsActive(value: string | undefined) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return true;
  return ["1", "true", "si", "sí", "activo", "activa"].includes(raw);
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "products:import:post",
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_ITEM_INVENTARIO");

  if (forbidden) return forbidden;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return new Response("CSV requerido en el campo file", { status: 400 });
    }

    const csvText = await file.text();
    const rows = parseCsv(csvText);

    if (rows.length === 0) {
      return new Response("El CSV no contiene filas válidas", { status: 400 });
    }

    const latestRate = await getLatestUsdCopRate();
    const trm = Number(latestRate?.effectiveRate ?? 0);

    if (!trm || trm <= 0) {
      return new Response("No hay TRM vigente. Actualiza la tasa USD/COP antes de importar.", {
        status: 400,
      });
    }

    let createdCount = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;

      try {
        const name = String(row.name ?? "").trim();

        if (!name) throw new Error("name requerido");

        const categoryId = await resolveCategoryIdFromRow(row);

        const priceCopR1 = asNumber(row.priceCopR1);
        const priceCopR2 = asNumber(row.priceCopR2);
        const priceCopR3 = asNumber(row.priceCopR3);
        const priceMayorista = asNumber(row.priceMayorista);
        const priceColanta = asNumber(row.priceColanta);
        const priceCopBase = asNumber(row.priceCopBase);

        if (priceCopR1 === null) throw new Error("priceCopR1 requerido");
        if (priceCopR2 === null) throw new Error("priceCopR2 requerido");
        if (priceCopR3 === null) throw new Error("priceCopR3 requerido");
        if (priceMayorista === null) throw new Error("priceMayorista requerido");
        if (priceColanta === null) throw new Error("priceColanta requerido");

        const priceCopInternational = Number((priceCopR1 * 1.19).toFixed(2));
        const priceUSD = Number((priceCopInternational / trm).toFixed(2));

        await db.transaction(async (tx) => {
          const productCode = await buildNextProductCodeTx(tx, categoryId);

          await tx.insert(products).values({
            productCode,
            name,
            description: String(row.description ?? "").trim() || null,
            categoryId,
            priceCopBase: String(priceCopBase ?? priceCopR1),
            priceCopR1: String(priceCopR1),
            priceCopR2: String(priceCopR2),
            priceCopR3: String(priceCopR3),
            priceViomar: null,
            priceColanta: String(priceColanta),
            priceMayorista: String(priceMayorista),
            priceCopInternational: String(priceCopInternational),
            priceUSD: String(priceUSD),
            trmUsed: String(trm),
            startDate: toOptionalDate(row.startDate),
            endDate: toOptionalDate(row.endDate),
            isActive: toIsActive(row.isActive),
          });
        });

        createdCount += 1;
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    }

    return Response.json({
      message: "Importación finalizada",
      totalRows: rows.length,
      createdCount,
      failedCount: errors.length,
      errors,
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;

    return new Response("No se pudo importar productos desde CSV", { status: 500 });
  }
}
