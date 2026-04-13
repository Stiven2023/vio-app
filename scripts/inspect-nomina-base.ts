/**
 * Script: Inspect BASE NOMINA.xlsx structure
 * Purpose: Extract columns, row count, data types, and normalization rules
 * Usage: pnpm tsx scripts/inspect-nomina-base.ts
 */

import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

// Allow piping to commands like Select-Object -First N without crashing on EPIPE.
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EPIPE") {
    process.exit(0);
  }

  throw error;
});

interface ColumnProfile {
  name: string;
  type: string;
  sampleValues: unknown[];
  missingCount: number;
  uniqueCount: number;
}

async function inspectNominaBase() {
  const externalPath = "D:\\Programación\\Vio\\BASE NOMINA.xlsx";
  const backupPath = "D:\\Programación\\Vio\\NOMINA BASE.xlsx";

  let filePath = externalPath;
  if (!fs.existsSync(filePath)) {
    filePath = backupPath;
  }

  if (!fs.existsSync(filePath)) {
    console.error(`❌ No se encontró el documento de nómina en:`);
    console.error(`   - ${externalPath}`);
    console.error(`   - ${backupPath}`);
    process.exit(1);
  }

  console.log(`\n📋 Inspeccionando: ${filePath}\n`);

  try {
    const workbook = XLSX.readFile(filePath, { cellFormula: false });
    const sheetNames = workbook.SheetNames;

    console.log(`📑 Hojas disponibles: ${sheetNames.join(", ")}`);

    // Usar la primera hoja por defecto
    const sheetName = sheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Leer datos manualmente desde el rango de celdas
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

    // Intentar detectar dónde comienzan los datos reales saltando encabezados y títulos
    let dataStartRow = 0;
    for (let i = 0; i < Math.min(allRows.length, 25); i++) {
      const row = allRows[i];
      const rowStr = row.map(String).join(" ").toLowerCase();
      if (
        rowStr.includes("cedula") ||
        rowStr.includes("identificaci") ||
        rowStr.includes("documento") ||
        rowStr.includes("nombre") ||
        rowStr.includes("salario")
      ) {
        dataStartRow = i;
        console.log(`\n✅ Encabezado encontrado en fila ${i + 1}`);
        break;
      }
    }

    // Convertir a formato con encabezados detectados
    const headerRow = allRows[dataStartRow];
    const rows: Record<string, unknown>[] = [];

    for (let i = dataStartRow + 1; i < allRows.length; i++) {
      const row = allRows[i];
      if (!row || row.every((v) => !v)) continue; // Skip empty rows

      const record: Record<string, unknown> = {};
      for (let j = 0; j < headerRow.length; j++) {
        const key = String(headerRow[j] || `Column_${j}`).trim();
        record[key] = row[j];
      }
      rows.push(record);
    }

    if (rows.length === 0) {
      console.error(`❌ La hoja "${sheetName}" está vacía.`);
      process.exit(1);
    }

    console.log(`\n✅ Datos leídos: ${rows.length} filas de nómina`);

    // Analizar estructura de columnas
    const headers = Object.keys(rows[0]);
    const profiles: Map<string, ColumnProfile> = new Map();

    for (const header of headers) {
      const values = rows.map((row) => row[header]);
      const nonNull = values.filter((v) => v !== null && v !== undefined && v !== "");
      const uniqueValues = Array.from(new Set(nonNull));

      // Detectar tipo de dato predominante
      let dataType = "unknown";
      if (uniqueValues.length > 0) {
        const firstNonNull = uniqueValues[0];
        if (typeof firstNonNull === "number") {
          dataType = "number";
        } else if (typeof firstNonNull === "string") {
          // Intentar detectar si es número enmascarado como texto
          if (/^\d+(\.\d+)?$/.test(String(firstNonNull))) {
            dataType = "text_numeric";
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(firstNonNull))) {
            dataType = "date_iso";
          } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(String(firstNonNull))) {
            dataType = "date_excel";
          } else {
            dataType = "text";
          }
        } else if (typeof firstNonNull === "boolean") {
          dataType = "boolean";
        }
      }

      profiles.set(header, {
        name: header,
        type: dataType,
        sampleValues: uniqueValues.slice(0, 3),
        missingCount: values.length - nonNull.length,
        uniqueCount: uniqueValues.length,
      });
    }

    // Mostrar perfil de columnas
    console.log(`\n📊 Perfil de Columnas (${headers.length} columnas):\n`);
    console.log("┌─────────────────────────────────────────────────────────────────┐");

    for (const [idx, header] of headers.entries()) {
      const profile = profiles.get(header)!;
      const pct = ((profile.missingCount / rows.length) * 100).toFixed(1);

      console.log(`\n${idx + 1}. ${header}`);
      console.log(`   Tipo: ${profile.type}`);
      console.log(`   Únicos: ${profile.uniqueCount}`);
      console.log(`   Vacíos: ${profile.missingCount} (${pct}%)`);

      if (profile.sampleValues.length > 0) {
        console.log(
          `   Ejemplos: ${profile.sampleValues.map((v) => JSON.stringify(v)).join(", ")}`,
        );
      }
    }

    console.log("\n└─────────────────────────────────────────────────────────────────┘");

    // Detectar campos críticos para nómina
    const lowerHeaders = headers.map((h) => h.toLowerCase());
    const criticalFields = {
      identification: headers.find(
        (h) =>
          lowerHeaders
            .find((l) => l === h.toLowerCase())
            ?.match(/cedula|identificaci[oó]n|documento|doc\.?|c\.c|cc|identification/i),
      ),
      name: headers.find(
        (h) =>
          lowerHeaders
            .find((l) => l === h.toLowerCase())
            ?.match(/nombre|name|empleado|employee/i),
      ),
      salaryBase: headers.find(
        (h) =>
          lowerHeaders.find((l) => l === h.toLowerCase())?.match(/salario|base|básico|salary/i),
      ),
      transportAllowance: headers.find(
        (h) =>
          lowerHeaders
            .find((l) => l === h.toLowerCase())
            ?.match(/transporte|auxilio|allowance|subsidio/i),
      ),
    };

    console.log(`\n🎯 Campos Críticos Detectados:\n`);
    Object.entries(criticalFields).forEach(([field, header]) => {
      console.log(`   ${field}: ${header || "❌ NO ENCONTRADO"}`);
    });

    // Mostrar primeras 3 filas de ejemplo
    console.log(`\n📄 Primeras 3 filas de datos:\n`);
    rows.slice(0, 3).forEach((row, idx) => {
      console.log(`Fila ${idx + 1}:`);
      headers.forEach((col) => {
        console.log(`  ${col}: ${JSON.stringify(row[col])}`);
      });
      console.log("");
    });

    // Resumen de reglas de normalización
    console.log(`\n⚙️ Reglas de Normalización Recomendadas:\n`);
    console.log(`1. Identificación: normalizar a mayúsculas, sin separadores`);
    console.log(`2. Montos: convertir a número decimal con 2 decimales`);
    console.log(`3. Fechas: convertir a formato YYYY-MM-DD`);
    console.log(`4. Nombres: trim() y normalización de caracteres especiales`);
    console.log(`5. Período: usar "2026-04" (YYYY-MM) para colillas en sistema`);

    console.log(`\n✅ Inspección completada.\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Error durante inspección: ${message}\n`);
    process.exit(1);
  }
}

inspectNominaBase().catch((error) => {
  console.error("❌ Error fatal:", error);
  process.exit(1);
});
