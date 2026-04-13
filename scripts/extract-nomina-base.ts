/**
 * Script: Extract and normalize payroll data from BASE NOMINA.xlsx
 * Purpose: Transform raw payroll data into normalized candidate records for employee matching
 * Output: JSON file with normalized payroll data
 * Usage: pnpm tsx scripts/extract-nomina-base.ts > data/nomina-base-normalized.json
 */

import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

interface NominaRawRow {
  "Nombre"?: string;
  "Cargo"?: string;
  "CC"?: number | string;
  "Salario   $/mes"?: number | string;
  "Auxilio de Transporte"?: number | string;
  "IBC"?: number | string;
  "Retencion en la fuente"?: number | string;
  "Días laborados en el período"?: number | string;
  [key: string]: unknown;
}

interface NominaCandidate {
  rowIndex: number;
  identification: string;
  identificationRaw: string;
  name: string;
  nameRaw: string;
  cargo: string;
  period: string;
  salarioBase: number;
  auxilioTransporte: number;
  ibc: number;
  retencionFuente: number;
  diasLaborados: number;
  novedades: Record<string, number>;
  validationErrors: string[];
}

function normalizeIdentification(id: unknown): { normalized: string; raw: string } {
  const raw = String(id || "").trim();
  // Remover separadores, espacios y convertir a mayúsculas
  const normalized = raw.replace(/[.\s-]/g, "").toUpperCase();
  return { normalized, raw };
}

function normalizeName(name: unknown): { normalized: string; raw: string } {
  const raw = String(name || "").trim();
  // Normalizar: trim, mayúsculas, remover múltiples espacios
  const normalized = raw
    .toUpperCase()
    .replace(/\s+/g, " ")
    .normalize("NFD");
  return { normalized, raw };
}

function toNumber(value: unknown, defaultValue: number = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

async function extractNominaBase() {
  const externalPath = "D:\\Programación\\Vio\\BASE NOMINA.xlsx";
  const backupPath = "D:\\Programación\\Vio\\NOMINA BASE.xlsx";

  let filePath = externalPath;
  if (!fs.existsSync(filePath)) {
    filePath = backupPath;
  }

  if (!fs.existsSync(filePath)) {
    console.error(`❌ No se encontró documento en: ${externalPath} ni ${backupPath}`);
    process.exit(1);
  }

  console.error(`📋 Extrayendo: ${filePath}\n`);

  try {
    const workbook = XLSX.readFile(filePath, { cellFormula: false });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Leer datos manualmente
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
    const allRows: unknown[][] = [];

    for (let row = range.s.r; row <= range.e.r; row++) {
      const rowData: unknown[] = [];
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        rowData.push(cell ? cell.v : null);
      }
      allRows.push(rowData);
    }

    // Detectar línea de encabezado
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(allRows.length, 30); i++) {
      const rowStr = allRows[i].map(String).join(" ").toLowerCase();
      if (rowStr.includes("nombre") && rowStr.includes("cc")) {
        headerRowIdx = i;
        break;
      }
    }

    const headerRow = allRows[headerRowIdx];
    const headerMap = new Map<number, string>();

    for (let j = 0; j < headerRow.length; j++) {
      const header = String(headerRow[j] || "").trim();
      if (header) {
        headerMap.set(j, header);
      }
    }

    console.error(`✅ Encabezado detectado en fila ${headerRowIdx + 1}`);
    console.error(`✅ Columnas detectadas: ${headerMap.size}\n`);

    // Extraer candidatos de nómina normalizados
    const candidates: NominaCandidate[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = headerRowIdx + 1; i < allRows.length; i++) {
      const row = allRows[i];

      // Construir objeto con headers
      const rowObj: Record<string, unknown> = {};
      for (let j = 0; j < row.length; j++) {
        const header = headerMap.get(j);
        if (header) {
          rowObj[header] = row[j];
        }
      }

      // Validar que tenga al menos identificación o nombre
      const cc = rowObj["CC"] as unknown;
      const nombre = rowObj["Nombre"] as unknown;

      if (!cc && !nombre) continue; // Skip empty rows

      const validationErrors: string[] = [];

      // Normalizar campos
      const { normalized: identification, raw: identificationRaw } = normalizeIdentification(cc);
      const { normalized: name, raw: nameRaw } = normalizeName(nombre);

      // Validaciones
      if (!identification || identification.length > 20) {
        validationErrors.push(`Identificación inválida: ${identificationRaw}`);
      }
      if (!name || name.length < 3) {
        validationErrors.push(`Nombre inválido o muy corto: ${nameRaw}`);
      }

      const salarioBase = toNumber(rowObj["Salario   $/mes"], 0);
      if (salarioBase <= 0) {
        validationErrors.push(`Salario base no válido: ${salarioBase}`);
      }

      const candidate: NominaCandidate = {
        rowIndex: i + 1,
        identification,
        identificationRaw,
        name,
        nameRaw,
        cargo: String(rowObj["Cargo"] || "").trim(),
        period: "2026-04", // Primera quincena abril 2026
        salarioBase,
        auxilioTransporte: toNumber(rowObj["Auxilio de Transporte"], 0),
        ibc: toNumber(rowObj["IBC"], salarioBase),
        retencionFuente: toNumber(rowObj["Retencion en la fuente"], 0),
        diasLaborados: toNumber(rowObj["Días laborados en el período"], 0),
        novedades: {
          incapacidad: toNumber(rowObj["INCAPACIDAD"] || rowObj["incapacidad"], 0),
          vacaciones: toNumber(rowObj["DIAS VACACIONES"] || rowObj["VACACIONES"], 0),
          noRemunerado: toNumber(rowObj["NO REMUNERADO"], 0),
          licenciaRemunerada: toNumber(rowObj["LICENCIA REMUNERADA"] || rowObj["Remunerada"], 0),
        },
        validationErrors,
      };

      candidates.push(candidate);

      if (validationErrors.length > 0) {
        errors.push({
          row: i + 1,
          message: validationErrors.join("; "),
        });
      }
    }

    // Preparar output
    const output = {
      metadata: {
        sourceFile: filePath,
        sheetName,
        extractedAt: new Date().toISOString(),
        period: "2026-04-01_to_2026-04-15",
        totalRows: candidates.length,
        rowsWithErrors: errors.length,
      },
      candidates,
      errors,
      summary: {
        totalExtracted: candidates.length,
        validCandidates: candidates.filter((c) => c.validationErrors.length === 0).length,
        candidatesWithErrors: errors.length,
        validTaxIds: candidates.filter((c) => c.identification && c.identification.length > 0)
          .length,
      },
    };

    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Error: ${message}\n`);
    process.exit(1);
  }
}

extractNominaBase().catch((error) => {
  console.error("❌ Fatal:", error);
  process.exit(1);
});
