/**
 * Script: Complete payroll biweekly base reconciliation
 * Purpose: Extract, normalize, extract employees, match, and generate reconciliation report
 * Usage: pnpm tsx -r dotenv/config scripts/reconcile-nomina-complete.ts
 */

import * as XLSX from "xlsx";
import { db } from "@/src/db";
import { employees, legalStatusRecords } from "@/src/db/erp/schema";
import * as fs from "fs";
import * as path from "path";

interface NominaCandidate {
  rowIndex: number;
  identification: string;
  identificationRaw: string;
  name: string;
  salarioBase: number;
  auxilioTransporte: number;
  diasLaborados: number;
  cargoRaw: string;
  validationErrors: string[];
}

interface EmployeeCanonical {
  id: string;
  employeeCode: string;
  identification: string;
  name: string;
  email: string;
  isActive: boolean;  
}

interface MatchResult {
  nominaRow: number;
  nominaIdentification: string;
  nominaName: string;
  matchType: "MATCH_OK" | "NO_MATCH" | "MULTI_MATCH" | "INCONSISTENT_DATA";
  matchedEmployeeId: string | null;
  matchedEmployeeCode: string | null;
  confidence: number;
  details: string;
}

function normalizeId(id: unknown): string {
  return String(id || "").trim().replace(/[.\s-]/g, "").toUpperCase();
}

function normalizeName(name: unknown): string {
  return String(name || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}

function toNumber(value: unknown, defaultValue: number = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

async function executeCompleteReconciliation() {
  console.log("\n🚀 Inicie proceso de conciliación de nómina quincenal completo...\n");

  try {
    // FASE 1: Extraer y normalizar nómina
    console.log("📋 FASE 1: Extrayendo y normalizando nómina base...\n");

    const externalPath = "D:\\Programación\\Vio\\BASE NOMINA.xlsx";
    const backupPath = "D:\\Programación\\Vio\\NOMINA BASE.xlsx";

    let filePath = externalPath;
    if (!fs.existsSync(filePath)) {
      filePath = backupPath;
    }

    if (!fs.existsSync(filePath)) {
      console.error(`   ❌ Documento no encontrado`);
      process.exit(1);
    }

    console.log(`   📂 Leyendo: ${path.basename(filePath)}`);

    const workbook = XLSX.readFile(filePath, { cellFormula: false });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Leer datos del rango
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

    // Detectar encabezado
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

    console.log(`   ✅ Encabezado detectado en fila ${headerRowIdx + 1}`);

    // Extraer candidatos
    const candidatesRaw: NominaCandidate[] = [];

    for (let i = headerRowIdx + 1; i < allRows.length; i++) {
      const row = allRows[i];
      const rowObj: Record<string, unknown> = {};

      for (let j = 0; j < row.length; j++) {
        const header = headerMap.get(j);
        if (header) {
          rowObj[header] = row[j];
        }
      }

      const cc = rowObj["CC"];
      const nombre = rowObj["Nombre"];

      if (!cc && !nombre) continue;

      const validationErrors: string[] = [];
      const id = normalizeId(cc);
      const name = normalizeName(nombre);

      if (!id || id.length > 20) {
        validationErrors.push(`ID inválida`);
      }
      if (!name || name.length < 3) {
        validationErrors.push(`Nombre inválido`);
      }

      const salarioBase = toNumber(rowObj["Salario   $/mes"], 0);
      if (salarioBase <= 0) {
        validationErrors.push(`Salario no válido`);
      }

      candidatesRaw.push({
        rowIndex: i + 1,
        identification: id,
        identificationRaw: String(cc || "").trim(),
        name,
        salarioBase,
        auxilioTransporte: toNumber(rowObj["Auxilio de Transporte"], 0),
        diasLaborados: toNumber(rowObj["Días laborados en el período"], 30),
        cargoRaw: String(rowObj["Cargo"] || "").trim(),
        validationErrors,
      });
    }

    console.log(`   ✅ ${candidatesRaw.length} candidatos extraídos\n`);

    // FASE 2: Extraer empleados
    console.log("📋 FASE 2: Extrayendo empleados existentes...\n");

    const existingEmployees = await db.query.employees.findMany();

    console.log(`   ✅ ${existingEmployees.length} empleados encontrados`);

    // Construir índices
    const employeeById = new Map<string, EmployeeCanonical>();
    const employeesByNormId = new Map<string, EmployeeCanonical[]>();

    for (const emp of existingEmployees) {
      const normId = normalizeId(emp.identification);

      const canonical: EmployeeCanonical = {
        id: emp.id,
        employeeCode: emp.employeeCode,
        identification: emp.identification,
        name: emp.name,
        email: emp.email,
        isActive: emp.isActive ?? true,
      };

      employeeById.set(emp.id, canonical);

      if (!employeesByNormId.has(normId)) {
        employeesByNormId.set(normId, []);
      }
      employeesByNormId.get(normId)!.push(canonical);
    }

    console.log(`   ✅ ${employeesByNormId.size} IDs únicos indexados\n`);

    // FASE 3: Conciliación
    console.log("📋 FASE 3: Ejecutando reconciliación...\n");

    const matches: MatchResult[] = [];
    let matchOk = 0;
    let noMatch = 0;
    let multiMatch = 0;
    let inconsistent = 0;

    for (const candidate of candidatesRaw) {
      // Skip if has validation errors
      if (candidate.validationErrors.length > 0) {
        continue;
      }

      const matchedEmps = employeesByNormId.get(candidate.identification) || [];

      let result: MatchResult;

      if (matchedEmps.length === 1) {
        result = {
          nominaRow: candidate.rowIndex,
          nominaIdentification: candidate.identificationRaw,
          nominaName: candidate.name,
          matchType: "MATCH_OK",
          matchedEmployeeId: matchedEmps[0].id,
          matchedEmployeeCode: matchedEmps[0].employeeCode,
          confidence: 1.0,
          details: `Match exacto: ${matchedEmps[0].employeeCode}`,
        };
        matchOk++;
      } else if (matchedEmps.length > 1) {
        result = {
          nominaRow: candidate.rowIndex,
          nominaIdentification: candidate.identificationRaw,
          nominaName: candidate.name,
          matchType: "MULTI_MATCH",
          matchedEmployeeId: null,
          matchedEmployeeCode: null,
          confidence: 0.5,
          details: `Duplicados: ${matchedEmps.map((e) => e.employeeCode).join(", ")}`,
        };
        multiMatch++;
      } else {
        result = {
          nominaRow: candidate.rowIndex,
          nominaIdentification: candidate.identificationRaw,
          nominaName: candidate.name,
          matchType: "NO_MATCH",
          matchedEmployeeId: null,
          matchedEmployeeCode: null,
          confidence: 0.0,
          details: "Sin correspondencia en el sistema",
        };
        noMatch++;
      }

      matches.push(result);
    }

    console.log(`   ✅ Reconciliación completada:`);
    console.log(`      - ✅ OK: ${matchOk}`);
    console.log(`      - ❌ Sin match: ${noMatch}`);
    console.log(`      - ⚠️  Duplicados: ${multiMatch}`);
    console.log(`      - ⚠️  Inconsistente: ${inconsistent}`);
    console.log(`      - Total procesado: ${matches.length}\n`);

    // FASE 4: Generar reportes
    console.log("📋 FASE 4: Generando reportes...\n");

    // Crear directorio si no existe
    if (!fs.existsSync("data")) {
      fs.mkdirSync("data", { recursive: true });
    }

    // Reporte de conciliación
    const reconciliationReport = {
      executedAt: new Date().toISOString(),
      period: "2026-04-01_to_2026-04-15",
      statistics: {
        nominaCandidates: candidatesRaw.length,
        nominaCandidatesValidatedExcludingErrors:matches.length,
        systemEmployees: existingEmployees.length,
        matchOk,
        noMatch,
        multiMatch,
        inconsistent,
        coverage: `${((matchOk / matches.length) * 100).toFixed(1)}%`,
      },
      matches: matches,
      issues: matches.filter((m) => m.matchType !== "MATCH_OK"),
    };

    const reportPath = path.join("data", "nomina-reconciliation-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(reconciliationReport, null, 2), "utf-8");

    console.log(`   ✅ Reporte guardado: ${reportPath}`);

    // Setup de liquidación
    const validCandidates = matches
      .filter((m) => m.matchType === "MATCH_OK")
      .map((m) => ({
        nominaRowIndex: m.nominaRow,
        employeeId: m.matchedEmployeeId!,
        employeeCode: m.matchedEmployeeCode!,
        nominaIdentification: m.nominaIdentification,
        nominaName: m.nominaName,
        period: "2026-04",
      }));

    const setupPath = path.join("data", "nomina-liquidation-setup.json");
    fs.writeFileSync(
      setupPath,
      JSON.stringify(
        {
          executedAt: new Date().toISOString(),
          period: "2026-04",
          validCandidates: validCandidates.length,
          candidates: validCandidates,
        },
        null,
        2,
      ),
      "utf-8",
    );

    console.log(`   ✅ Setup guardado: ${setupPath}\n`);

    // Mostrar problemas
    if (reconciliationReport.issues.length > 0) {
      console.log("⚠️  PROBLEMAS DETECTADOS:\n");
      reconciliationReport.issues.slice(0, 5).forEach((issue) => {
        console.log(`   Fila ${issue.nominaRow}: [${issue.matchType}] ${issue.nominaName}`);
        console.log(`   └─ ${issue.details}\n`);
      });

      if (reconciliationReport.issues.length > 5) {
        console.log(`   ... y ${reconciliationReport.issues.length - 5} más\n`);
      }
    }

    console.log("✅ RECONCILIACIÓN COMPLETADA\n");
    console.log("🎯 Próximos pasos:");
    console.log("   1. Revisar reporte: data/nomina-reconciliation-report.json");
    console.log("   2. Resolver problemas de conciliación");
    console.log("   3. Ejecutar modo DRY_RUN para validar cálculos");
    console.log("   4. Ejecutar modo APPLY para liquidar\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Error: ${message}\n`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

executeCompleteReconciliation()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
  });
