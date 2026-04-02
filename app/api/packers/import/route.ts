import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { packers } from "@/src/db/erp/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type ImportRow = {
  packerCode?: string;
  name?: string;
  identificationType?: string;
  identification?: string;
  packerType?: string;
  specialty?: string;
  contactName?: string;
  email?: string;
  mobile?: string;
  address?: string;
  city?: string;
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
  if (!utf8Text.includes("�")) return utf8Text;
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

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
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
  return cells.map((c) => c.trim());
}

function parseIsActive(value: string | undefined): boolean | undefined {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return undefined;
  if (["1", "true", "si", "sí", "activo", "activa"].includes(raw)) return true;
  if (["0", "false", "no", "inactivo", "inactiva"].includes(raw)) return false;
  throw new Error("isActive inválido: usa SI/NO o true/false");
}

function parseCsv(content: string): ImportRow[] {
  const normalized = content
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
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
      packerCode: getCell(cells, ["packerCode", "codigoEmpaquetador", "codigoEmpaque"]),
      name: getCell(cells, ["name", "nombre"]),
      identificationType: getCell(cells, [
        "identificationType",
        "tipoIdentificacion",
        "tipoDoc",
      ]),
      identification: getCell(cells, ["identification", "identificacion", "documento"]),
      packerType: getCell(cells, ["packerType", "tipoEmpaquetador", "tipo"]),
      specialty: getCell(cells, ["specialty", "especialidad"]),
      contactName: getCell(cells, ["contactName", "nombreContacto", "contacto"]),
      email: getCell(cells, ["email", "correo"]),
      mobile: getCell(cells, ["mobile", "celular", "movil"]),
      address: getCell(cells, ["address", "direccion"]),
      city: getCell(cells, ["city", "ciudad"]),
      isActive: getCell(cells, ["isActive", "activo", "estado"]),
    };

    if (!row.name && !row.packerCode) continue;
    rows.push(row);
  }

  return rows;
}

async function generatePackerCode(): Promise<string> {
  const [last] = await db
    .select({ code: packers.packerCode })
    .from(packers)
    .orderBy(sql`${packers.packerCode} DESC`)
    .limit(1);

  let nextNumber = 1001;
  if (last?.code) {
    const parsed = Number.parseInt(last.code.replace(/^EMPA/i, ""), 10);
    if (!Number.isNaN(parsed)) nextNumber = parsed + 1;
  }
  return `EMPA${nextNumber}`;
}

const VALID_ID_TYPES = ["CC", "NIT", "CE", "PAS", "EMPRESA_EXTERIOR"] as const;

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "packers:import:post",
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_EMPAQUE");

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

    let createdCount = 0;
    let updatedCount = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;

      try {
        const packerCodeRaw = String(row.packerCode ?? "").trim().toUpperCase();
        const isEdit = packerCodeRaw.length > 0;

        if (!isEdit) {
          const name = String(row.name ?? "").trim();
          if (!name) throw new Error("name requerido en creación");

          const identificationTypeRaw = String(
            row.identificationType ?? ""
          ).trim().toUpperCase() as (typeof VALID_ID_TYPES)[number];
          if (!VALID_ID_TYPES.includes(identificationTypeRaw)) {
            throw new Error(
              `identificationType inválido: ${identificationTypeRaw}. Usa: ${VALID_ID_TYPES.join(", ")}`
            );
          }

          const identification = String(row.identification ?? "").trim();
          if (!identification) throw new Error("identification requerida en creación");

          const address = String(row.address ?? "").trim();
          if (!address) throw new Error("address requerido en creación");

          const [duplicate] = await db
            .select({ id: packers.id })
            .from(packers)
            .where(eq(packers.identification, identification))
            .limit(1);

          if (duplicate) {
            throw new Error(
              `Ya existe un empaquetador con identificación: ${identification}`
            );
          }

          const packerCode = await generatePackerCode();

          await db.insert(packers).values({
            packerCode,
            name,
            identificationType: identificationTypeRaw,
            identification,
            packerType: row.packerType ? String(row.packerType).trim() : null,
            specialty: row.specialty ? String(row.specialty).trim() : null,
            contactName: row.contactName ? String(row.contactName).trim() : null,
            email: row.email ? String(row.email).trim() : null,
            mobile: row.mobile ? String(row.mobile).trim() : null,
            address,
            city: row.city ? String(row.city).trim() : "Medellín",
            intlDialCode: "57",
            isActive: true,
          });

          createdCount += 1;
          continue;
        }

        const [existing] = await db
          .select()
          .from(packers)
          .where(eq(packers.packerCode, packerCodeRaw))
          .limit(1);

        if (!existing) {
          throw new Error(`packerCode no existe para edición: ${packerCodeRaw}`);
        }

        const patch: Partial<typeof packers.$inferInsert> = {};

        if (row.name?.trim()) patch.name = row.name.trim();
        if (row.contactName?.trim()) patch.contactName = row.contactName.trim();
        if (row.email?.trim()) patch.email = row.email.trim();
        if (row.address?.trim()) patch.address = row.address.trim();
        if (row.city?.trim()) patch.city = row.city.trim();
        if (row.mobile?.trim()) patch.mobile = row.mobile.trim();
        if (row.packerType?.trim()) patch.packerType = row.packerType.trim();
        if (row.specialty?.trim()) patch.specialty = row.specialty.trim();

        const activeValue = parseIsActive(row.isActive);
        if (activeValue !== undefined) patch.isActive = activeValue;

        if (Object.keys(patch).length === 0) {
          throw new Error(`Fila sin cambios para edición (${packerCodeRaw})`);
        }

        await db.update(packers).set(patch).where(eq(packers.id, existing.id));

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

    return new Response("No se pudo importar empaquetadores desde CSV", {
      status: 500,
    });
  }
}
