import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { categories, products } from "@/src/db/schema";
import { getLatestUsdCopRate } from "@/src/utils/exchange-rate";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type ImportRow = {
  categoryId?: string;
  categoryName?: string;
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
  isActive?: string;
};

function normalizeHeader(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function decodeCsvTextFromBytes(bytes: Uint8Array) {
  const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

  if (!utf8Text.includes("�")) {
    return utf8Text;
  }

  try {
    return new TextDecoder("windows-1252").decode(bytes);
  } catch {
    return utf8Text;
  }
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
    .filter((line) => line.length > 0 && !line.startsWith("#"));

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
      categoryName: getCell(cells, ["categoryName", "categoria", "nombreCategoria", "nombreDeCategoria"]),
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
      isActive: getCell(cells, ["isActive", "activo", "estado"]),
    };

    if (!row.name && !row.categoryId && !row.categoryName) continue;
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

function normalizeCategoryName(value: string) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmptyToken(value: unknown) {
  const raw = String(value ?? "").trim();

  if (!raw) return true;

  const compact = raw
    .toUpperCase()
    .replace(/[\s._]/g, "")
    .replace(/Á/g, "A")
    .replace(/É/g, "E")
    .replace(/Í/g, "I")
    .replace(/Ó/g, "O")
    .replace(/Ú/g, "U");

  return [
    "-",
    "--",
    "N/A",
    "NA",
    "NULL",
    "NONE",
    "NULO",
    "NOAPLICA",
    "S/D",
    "SD",
  ].includes(compact);
}

async function resolveCategoryIdFromRow(args: {
  row: ImportRow;
  categoryIdSet: Set<string>;
  categoryNameToId: Map<string, string>;
}) {
  const { row, categoryIdSet, categoryNameToId } = args;
  const categoryIdRaw = String(row.categoryId ?? "").trim();

  if (categoryIdRaw) {
    if (categoryIdSet.has(categoryIdRaw)) {
      return categoryIdRaw;
    }

    const normalizedFromCategoryId = normalizeCategoryName(categoryIdRaw);
    const byName = categoryNameToId.get(normalizedFromCategoryId);
    if (byName) {
      return byName;
    }

    throw new Error(`categoryId inválido: ${categoryIdRaw}`);
  }

  const categoryNameRaw = String(row.categoryName ?? "").trim();
  if (categoryNameRaw) {
    const normalizedCategoryName = normalizeCategoryName(categoryNameRaw);
    const categoryId = categoryNameToId.get(normalizedCategoryName);

    if (!categoryId) {
      throw new Error(`Categoría no encontrada: ${categoryNameRaw}`);
    }

    return categoryId;
  }

  throw new Error("categoryId o categoryName requerido");
}

function asNumber(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (isEmptyToken(raw)) return null;

  const normalized = raw
    .replace(/\$/g, "")
    .replace(/\s+/g, "")
    .replace(/COP|USD/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function hasValue(value: unknown) {
  return !isEmptyToken(value);
}

function parseOptionalNumber(value: unknown, label: string) {
  if (!hasValue(value)) return undefined;
  const parsed = asNumber(value);
  if (parsed === null) {
    throw new Error(`${label} inválido`);
  }
  return parsed;
}

function parseIsActiveForEdit(value: string | undefined) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return undefined;
  if (["1", "true", "si", "sí", "activo", "activa"].includes(raw)) return true;
  if (["0", "false", "no", "inactivo", "inactiva"].includes(raw)) return false;
  throw new Error("isActive inválido: usa SI/NO o true/false");
}

function buildAutomaticValidityDates() {
  const now = new Date();
  const nextYearFebFirst = new Date(now.getFullYear() + 1, 1, 1, 0, 0, 0, 0);
  return {
    startDate: now,
    endDate: nextYearFebFirst,
  };
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

    const bytes = new Uint8Array(await file.arrayBuffer());
    const csvText = decodeCsvTextFromBytes(bytes);
    const rows = parseCsv(csvText);

    if (rows.length === 0) {
      return new Response("El CSV no contiene filas válidas", { status: 400 });
    }

    const latestRate = await getLatestUsdCopRate();
    const trm = Number(latestRate?.effectiveRate ?? 0);

    const categoryRows = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories);
    const categoryIdSet = new Set(categoryRows.map((c) => String(c.id)));
    const categoryNameToId = new Map<string, string>();
    for (const category of categoryRows) {
      const normalizedName = normalizeCategoryName(String(category.name ?? ""));
      if (!normalizedName) continue;
      if (!categoryNameToId.has(normalizedName)) {
        categoryNameToId.set(normalizedName, String(category.id));
      }
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;

      try {
        const productCodeRaw = String(row.productCode ?? "").trim().toUpperCase();
        const isEdit = productCodeRaw.length > 0;

        if (!isEdit) {
          const name = String(row.name ?? "").trim();

          if (!name) throw new Error("name requerido en creación");

          const categoryId = await resolveCategoryIdFromRow({
            row,
            categoryIdSet,
            categoryNameToId,
          });

          const priceCopR1 = parseOptionalNumber(row.priceCopR1, "priceCopR1") ?? null;
          const priceCopR2 = parseOptionalNumber(row.priceCopR2, "priceCopR2") ?? null;
          const priceCopR3 = parseOptionalNumber(row.priceCopR3, "priceCopR3") ?? null;
          const priceMayorista =
            parseOptionalNumber(row.priceMayorista, "priceMayorista") ?? null;
          const priceColanta = parseOptionalNumber(row.priceColanta, "priceColanta") ?? null;
          const priceCopBase = parseOptionalNumber(row.priceCopBase, "priceCopBase") ?? null;

          const priceCopInternational =
            priceCopR1 !== null ? Number((priceCopR1 * 1.19).toFixed(2)) : null;
          const priceUSD =
            priceCopInternational !== null && trm > 0
              ? Number((priceCopInternational / trm).toFixed(2))
              : null;
          const validity = buildAutomaticValidityDates();

          await db.transaction(async (tx) => {
            const productCode = await buildNextProductCodeTx(tx, categoryId);

            await tx.insert(products).values({
              productCode,
              name,
              description: String(row.description ?? "").trim() || null,
              categoryId,
              priceCopBase: priceCopBase !== null
                ? String(priceCopBase)
                : priceCopR1 !== null
                  ? String(priceCopR1)
                  : null,
              priceCopR1: priceCopR1 !== null ? String(priceCopR1) : null,
              priceCopR2: priceCopR2 !== null ? String(priceCopR2) : null,
              priceCopR3: priceCopR3 !== null ? String(priceCopR3) : null,
              priceViomar: null,
              priceColanta: priceColanta !== null ? String(priceColanta) : null,
              priceMayorista: priceMayorista !== null ? String(priceMayorista) : null,
              priceCopInternational:
                priceCopInternational !== null ? String(priceCopInternational) : null,
              priceUSD: priceUSD !== null ? String(priceUSD) : null,
              trmUsed: priceUSD !== null ? String(trm) : null,
              startDate: validity.startDate,
              endDate: validity.endDate,
              isActive: true,
            });
          });

          createdCount += 1;
          continue;
        }

        const [existing] = await db
          .select()
          .from(products)
          .where(eq(products.productCode, productCodeRaw))
          .limit(1);

        if (!existing) {
          throw new Error(`productCode no existe para edición: ${productCodeRaw}`);
        }

        const categoryProvided = hasValue(row.categoryId) || hasValue(row.categoryName);
        const categoryId = categoryProvided
          ? await resolveCategoryIdFromRow({ row, categoryIdSet, categoryNameToId })
          : String(existing.categoryId ?? "").trim() || null;

        const nextPriceCopR1 = parseOptionalNumber(row.priceCopR1, "priceCopR1") ?? asNumber(existing.priceCopR1);
        const nextPriceCopR2 = parseOptionalNumber(row.priceCopR2, "priceCopR2") ?? asNumber(existing.priceCopR2);
        const nextPriceCopR3 = parseOptionalNumber(row.priceCopR3, "priceCopR3") ?? asNumber(existing.priceCopR3);
        const nextPriceMayorista = parseOptionalNumber(row.priceMayorista, "priceMayorista") ?? asNumber(existing.priceMayorista);
        const nextPriceColanta = parseOptionalNumber(row.priceColanta, "priceColanta") ?? asNumber(existing.priceColanta);
        const nextPriceCopBase = parseOptionalNumber(row.priceCopBase, "priceCopBase") ?? asNumber(existing.priceCopBase);
        const nextIsActive = parseIsActiveForEdit(row.isActive);

        const hasPriceInputs =
          hasValue(row.priceCopR1) ||
          hasValue(row.priceCopR2) ||
          hasValue(row.priceCopR3) ||
          hasValue(row.priceMayorista) ||
          hasValue(row.priceColanta) ||
          hasValue(row.priceCopBase);

        const patch: Partial<typeof products.$inferInsert> = {};

        if (hasValue(row.name)) patch.name = String(row.name ?? "").trim();
        if (hasValue(row.description)) patch.description = String(row.description ?? "").trim();
        if (categoryProvided) patch.categoryId = categoryId;
        if (nextIsActive !== undefined) patch.isActive = nextIsActive;

        if (hasPriceInputs) {
          const priceCopInternational =
            nextPriceCopR1 !== null
              ? Number((nextPriceCopR1 * 1.19).toFixed(2))
              : null;
          const priceUSD =
            priceCopInternational !== null && trm > 0
              ? Number((priceCopInternational / trm).toFixed(2))
              : null;

          patch.priceCopBase =
            nextPriceCopBase !== null
              ? String(nextPriceCopBase)
              : nextPriceCopR1 !== null
                ? String(nextPriceCopR1)
                : null;
          patch.priceCopR1 = nextPriceCopR1 !== null ? String(nextPriceCopR1) : null;
          patch.priceCopR2 = nextPriceCopR2 !== null ? String(nextPriceCopR2) : null;
          patch.priceCopR3 = nextPriceCopR3 !== null ? String(nextPriceCopR3) : null;
          patch.priceMayorista =
            nextPriceMayorista !== null ? String(nextPriceMayorista) : null;
          patch.priceColanta = nextPriceColanta !== null ? String(nextPriceColanta) : null;
          patch.priceCopInternational =
            priceCopInternational !== null ? String(priceCopInternational) : null;
          patch.priceUSD = priceUSD !== null ? String(priceUSD) : null;
          patch.trmUsed = priceUSD !== null ? String(trm) : null;
        }

        if (Object.keys(patch).length === 0) {
          throw new Error(`Fila sin cambios para edición (${productCodeRaw})`);
        }

        await db
          .update(products)
          .set(patch)
          .where(eq(products.id, existing.id));

        updatedCount += 1;
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
      updatedCount,
      failedCount: errors.length,
      errors,
    });
  } catch (error) {
    const response = dbErrorResponse(error);
    if (response) return response;

    return new Response("No se pudo importar productos desde CSV", { status: 500 });
  }
}
