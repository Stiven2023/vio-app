import { eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { clients } from "@/src/db/schema";
import { dbErrorResponse } from "@/src/utils/db-errors";
import { requirePermission } from "@/src/utils/permission-middleware";
import { rateLimit } from "@/src/utils/rate-limit";

type ImportRow = {
  clientCode?: string;
  clientType?: string;
  name?: string;
  identificationType?: string;
  identification?: string;
  dv?: string;
  taxRegime?: string;
  contactName?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  department?: string;
  country?: string;
  mobile?: string;
  isActive?: string;
};

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
      clientCode: getCell(cells, ["clientCode", "codigoCliente"]),
      clientType: getCell(cells, ["clientType", "tipoCliente", "tipo"]),
      name: getCell(cells, ["name", "nombre"]),
      identificationType: getCell(cells, [
        "identificationType",
        "tipoIdentificacion",
        "tipoDoc",
      ]),
      identification: getCell(cells, ["identification", "identificacion", "documento"]),
      dv: getCell(cells, ["dv", "digitoVerificacion"]),
      taxRegime: getCell(cells, ["taxRegime", "regimenFiscal", "regimen"]),
      contactName: getCell(cells, ["contactName", "nombreContacto", "contacto"]),
      email: getCell(cells, ["email", "correo"]),
      address: getCell(cells, ["address", "direccion"]),
      postalCode: getCell(cells, ["postalCode", "codigoPostal"]),
      city: getCell(cells, ["city", "ciudad"]),
      department: getCell(cells, ["department", "departamento"]),
      country: getCell(cells, ["country", "pais"]),
      mobile: getCell(cells, ["mobile", "celular", "movil"]),
      isActive: getCell(cells, ["isActive", "activo", "estado"]),
    };

    if (!row.name && !row.clientCode) continue;
    rows.push(row);
  }

  return rows;
}

async function generateClientCode(
  tx: DbTransaction,
  clientType: "NACIONAL" | "EXTRANJERO" | "EMPLEADO"
): Promise<string> {
  const prefix =
    clientType === "NACIONAL" ? "CN" : clientType === "EXTRANJERO" ? "CE" : "EM";

  const lastClient = await tx
    .select({ code: clients.clientCode })
    .from(clients)
    .where(sql`${clients.clientCode} LIKE ${prefix + "%"}`)
    .orderBy(sql`${clients.clientCode} DESC`)
    .limit(1);

  let nextNumber = 10001;
  if (lastClient.length > 0 && lastClient[0]?.code) {
    const lastNumber = Number.parseInt(lastClient[0].code.slice(prefix.length), 10);
    if (!Number.isNaN(lastNumber)) nextNumber = lastNumber + 1;
  }

  return `${prefix}${nextNumber}`;
}

const VALID_CLIENT_TYPES = ["NACIONAL", "EXTRANJERO", "EMPLEADO"] as const;
const VALID_ID_TYPES = ["CC", "NIT", "CE", "PAS", "EMPRESA_EXTERIOR"] as const;
const VALID_TAX_REGIMES = [
  "REGIMEN_COMUN",
  "REGIMEN_SIMPLIFICADO",
  "NO_RESPONSABLE",
] as const;

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "clients:import:post",
    limit: 20,
    windowMs: 60_000,
  });

  if (limited) return limited;

  const forbidden = await requirePermission(request, "CREAR_CLIENTE");

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
        const clientCodeRaw = String(row.clientCode ?? "").trim().toUpperCase();
        const isEdit = clientCodeRaw.length > 0;

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

          const taxRegimeRaw = String(
            row.taxRegime ?? ""
          ).trim().toUpperCase() as (typeof VALID_TAX_REGIMES)[number];
          if (!VALID_TAX_REGIMES.includes(taxRegimeRaw)) {
            throw new Error(
              `taxRegime inválido: ${taxRegimeRaw}. Usa: ${VALID_TAX_REGIMES.join(", ")}`
            );
          }

          const contactName = String(row.contactName ?? "").trim();
          if (!contactName) throw new Error("contactName requerido en creación");

          const email = String(row.email ?? "").trim();
          if (!email) throw new Error("email requerido en creación");

          const address = String(row.address ?? "").trim();
          if (!address) throw new Error("address requerido en creación");

          const clientTypeRaw = String(
            row.clientType ?? "NACIONAL"
          ).trim().toUpperCase() as (typeof VALID_CLIENT_TYPES)[number];
          const clientType = VALID_CLIENT_TYPES.includes(clientTypeRaw)
            ? clientTypeRaw
            : "NACIONAL";

          const [duplicate] = await db
            .select({ id: clients.id })
            .from(clients)
            .where(eq(clients.identification, identification))
            .limit(1);

          if (duplicate) {
            throw new Error(
              `Ya existe un cliente con identificación: ${identification}`
            );
          }

          await db.transaction(async (tx) => {
            const clientCode = await generateClientCode(tx, clientType);

            await tx.insert(clients).values({
              clientCode,
              clientType,
              name,
              identificationType: identificationTypeRaw,
              identification,
              dv: row.dv ? String(row.dv).trim() : null,
              taxRegime: taxRegimeRaw,
              contactName,
              email,
              address,
              postalCode: row.postalCode ? String(row.postalCode).trim() : null,
              city: row.city ? String(row.city).trim() : "Medellín",
              department: row.department ? String(row.department).trim() : "ANTIOQUIA",
              country: row.country ? String(row.country).trim() : "COLOMBIA",
              mobile: row.mobile ? String(row.mobile).trim() : null,
              intlDialCode: "57",
              isActive: true,
            });
          });

          createdCount += 1;
          continue;
        }

        const [existing] = await db
          .select()
          .from(clients)
          .where(eq(clients.clientCode, clientCodeRaw))
          .limit(1);

        if (!existing) {
          throw new Error(`clientCode no existe para edición: ${clientCodeRaw}`);
        }

        const patch: Partial<typeof clients.$inferInsert> = {};

        if (row.name?.trim()) patch.name = row.name.trim();
        if (row.contactName?.trim()) patch.contactName = row.contactName.trim();
        if (row.email?.trim()) patch.email = row.email.trim();
        if (row.address?.trim()) patch.address = row.address.trim();
        if (row.postalCode?.trim()) patch.postalCode = row.postalCode.trim();
        if (row.city?.trim()) patch.city = row.city.trim();
        if (row.department?.trim()) patch.department = row.department.trim();
        if (row.country?.trim()) patch.country = row.country.trim();
        if (row.mobile?.trim()) patch.mobile = row.mobile.trim();
        if (row.dv?.trim()) patch.dv = row.dv.trim();

        if (row.taxRegime?.trim()) {
          const taxRegimeRaw = row.taxRegime.trim().toUpperCase() as (typeof VALID_TAX_REGIMES)[number];
          if (!VALID_TAX_REGIMES.includes(taxRegimeRaw)) {
            throw new Error(`taxRegime inválido: ${taxRegimeRaw}`);
          }
          patch.taxRegime = taxRegimeRaw;
        }

        const activeValue = parseIsActive(row.isActive);
        if (activeValue !== undefined) patch.isActive = activeValue;

        if (Object.keys(patch).length === 0) {
          throw new Error(`Fila sin cambios para edición (${clientCodeRaw})`);
        }

        await db.update(clients).set(patch).where(eq(clients.id, existing.id));

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

    return new Response("No se pudo importar clientes desde CSV", { status: 500 });
  }
}
