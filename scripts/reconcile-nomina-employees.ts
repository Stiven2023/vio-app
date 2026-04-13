/**
 * Script: Extract existing employees and perform biweekly payroll reconciliation
 * Purpose: Match payroll source data against existing employee database
 * Classification: MATCH_OK, NO_MATCH, MULTI_MATCH, INCONSISTENT_DATA
 * Output: Reconciliation report and matching results
 * Usage: pnpm tsx scripts/reconcile-nomina-employees.ts
 */

import { db } from "@/src/db";
import { employees, legalStatusRecords } from "@/src/db/erp/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

interface EmployeeCanonical {
  id: string;
  employeeCode: string;
  identification: string;
  identificationNormalized: string;
  name: string;
  nameNormalized: string;
  isActive: boolean;
  legalStatus: string | null;
  email: string;
}

interface NominaCandidate {
  rowIndex: number;
  identification: string;
  name: string;
  salarioBase: number;
  auxilioTransporte: number;
  diasLaborados: number;
}

interface MatchResult {
  nominaRow: number;
  nominaId: string;
  nominaName: string;
  matchType: "MATCH_OK" | "NO_MATCH" | "MULTI_MATCH" | "INCONSISTENT_DATA";
  matchedEmployeeIds: string[];
  matchedEmployeeCodes: string[];
  confidence: number;
  details: string;
}

function normalizeString(str: string): string {
  return str
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 50);
}

function normalizeTaxId(id: string): string {
  return id.replace(/[.\s-]/g, "").toUpperCase();
}

function calculateStringDistance(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  let matches = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) matches++;
  }

  return matches / maxLen;
}

async function reconcileNominaEmployees() {
  console.log("\n📊 Iniciando reconciliación de nómina quincenal...\n");

  try {
    // Leer candidatos de nómina normalizados
    const nominaFile = path.join("data", "nomina-base-normalized.json");
    if (!fs.existsSync(nominaFile)) {
      console.error(`❌ Archivo no encontrado: ${nominaFile}`);
      console.error("   Ejecuta primero: pnpm tsx scripts/extract-nomina-base.ts");
      process.exit(1);
    }

    const nominaData = JSON.parse(fs.readFileSync(nominaFile, "utf-8"));
    const nominaCandidates = nominaData.candidates as NominaCandidate[];

    console.log(`✅ Candidatos de nómina cargados: ${nominaCandidates.length}`);

    // Extraer empleados existentes
    console.log("📥 Extrayendo empleados del sistema...");

    const existingEmployees = await db.query.employees.findMany();
    console.log(`✅ Empleados existentes: ${existingEmployees.length}`);

    // Construir mapa canónico de empleados
    const employeeMap = new Map<string, EmployeeCanonical>();
    const employeesByNormalizedId = new Map<string, EmployeeCanonical[]>();
    const employeesByNormalizedName = new Map<string, EmployeeCanonical[]>();

    for (const emp of existingEmployees) {
      const idNorm = normalizeTaxId(emp.identification);
      const nameNorm = normalizeString(emp.name);

      const canonical: EmployeeCanonical = {
        id: emp.id,
        employeeCode: emp.employeeCode,
        identification: emp.identification,
        identificationNormalized: idNorm,
        name: emp.name,
        nameNormalized: nameNorm,
        isActive: emp.isActive ?? true,
        legalStatus: null,
        email: emp.email,
      };

      employeeMap.set(emp.id, canonical);

      // Indexar por identificación normalizada
      if (!employeesByNormalizedId.has(idNorm)) {
        employeesByNormalizedId.set(idNorm, []);
      }
      employeesByNormalizedId.get(idNorm)!.push(canonical);

      // Indexar por nombre normalizado
      if (!employeesByNormalizedName.has(nameNorm)) {
        employeesByNormalizedName.set(nameNorm, []);
      }
      employeesByNormalizedName.get(nameNorm)!.push(canonical);
    }

    console.log(
      `✅ Índices construidos: ${employeesByNormalizedId.size} IDs únicos, ${employeesByNormalizedName.size} nombres únicos\n`,
    );

    // Ejecutar conciliación
    console.log("🔍 Ejecutando matching...\n");

    const matches: MatchResult[] = [];
    const stats = {
      matchOk: 0,
      noMatch: 0,
      multiMatch: 0,
      inconsistentData: 0,
    };

    for (const candidate of nominaCandidates) {
      // Skip candidates with validation errors
      if ("validationErrors" in candidate && (candidate as any).validationErrors.length > 0) {
        continue;
      }

      const idNorm = normalizeTaxId(candidate.identification);
      const nameNorm = normalizeString(candidate.name);

      // Primary match: exact identification
      const matchesByID = employeesByNormalizedId.get(idNorm) || [];

      if (matchesByID.length === 1) {
        // Perfect match
        matches.push({
          nominaRow: candidate.rowIndex,
          nominaId: candidate.identification,
          nominaName: candidate.name,
          matchType: "MATCH_OK",
          matchedEmployeeIds: [matchesByID[0].id],
          matchedEmployeeCodes: [matchesByID[0].employeeCode],
          confidence: 1.0,
          details: `Match exacto por identificación: ${matchesByID[0].employeeCode}`,
        });
        stats.matchOk++;
      } else if (matchesByID.length > 1) {
        // Multiple matches by ID - critical!
        matches.push({
          nominaRow: candidate.rowIndex,
          nominaId: candidate.identification,
          nominaName: candidate.name,
          matchType: "MULTI_MATCH",
          matchedEmployeeIds: matchesByID.map((e) => e.id),
          matchedEmployeeCodes: matchesByID.map((e) => e.employeeCode),
          confidence: 0.5,
          details: `Identificación duplicada en sistema: ${matchesByID.map((e) => e.employeeCode).join(", ")}`,
        });
        stats.multiMatch++;
      } else {
        // Secondary match: try by name (for diagnostics only)
        const matchesByName = employeesByNormalizedName.get(nameNorm) || [];

        if (matchesByName.length === 1) {
          const nameDistance = calculateStringDistance(
            normalizeString(candidate.name),
            normalizeString(matchesByName[0].name),
          );

          matches.push({
            nominaRow: candidate.rowIndex,
            nominaId: candidate.identification,
            nominaName: candidate.name,
            matchType: "INCONSISTENT_DATA",
            matchedEmployeeIds: [matchesByName[0].id],
            matchedEmployeeCodes: [matchesByName[0].employeeCode],
            confidence: nameDistance,
            details: `Match por nombre (${(nameDistance * 100).toFixed(1)}%), sin identificación correspondiente en sistema`,
          });
          stats.inconsistentData++;
        } else if (matchesByName.length > 1) {
          matches.push({
            nominaRow: candidate.rowIndex,
            nominaId: candidate.identification,
            nominaName: candidate.name,
            matchType: "MULTI_MATCH",
            matchedEmployeeIds: matchesByName.map((e) => e.id),
            matchedEmployeeCodes: matchesByName.map((e) => e.employeeCode),
            confidence: 0.3,
            details: `Múltiples empleados con nombre similar (${matchesByName.length})`,
          });
          stats.multiMatch++;
        } else {
          // No match found
          matches.push({
            nominaRow: candidate.rowIndex,
            nominaId: candidate.identification,
            nominaName: candidate.name,
            matchType: "NO_MATCH",
            matchedEmployeeIds: [],
            matchedEmployeeCodes: [],
            confidence: 0.0,
            details: "No hay identificación ni nombre correspondiente en el sistema",
          });
          stats.noMatch++;
        }
      }
    }

    // Generar reporte
    const report = {
      executedAt: new Date().toISOString(),
      period: "2026-04-01_to_2026-04-15",
      payrollCanditates: nominaCandidates.length,
      statistics: {
        totalProcessed: matches.length,
        matchOk: stats.matchOk,
        noMatch: stats.noMatch,
        multiMatch: stats.multiMatch,
        inconsistentData: stats.inconsistentData,
        percentageMatched: (
          ((stats.matchOk / matches.length) * 100 || 0).toFixed(1) + "%"
        ),
        percentageIssues: (
          (((stats.noMatch + stats.multiMatch + stats.inconsistentData) / matches.length) * 100 ||
            0).toFixed(1) + "%"
        ),
      },
      systemEmployees: existingEmployees.length,
      reconciliationResults: matches,
      issues: matches.filter(
        (m) =>
          m.matchType === "NO_MATCH" ||
          m.matchType === "MULTI_MATCH" ||
          m.matchType === "INCONSISTENT_DATA",
      ),
    };

    // Guardar reporte
    const reportFile = path.join("data", "nomina-reconciliation-report.json");
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    console.log("📋 RESUMEN DE CONCILIACIÓN:\n");
    console.log(`   Total procesados: ${report.statistics.totalProcessed}`);
    console.log(`   ✅ Match OK: ${stats.matchOk} (${report.statistics.percentageMatched})`);
    console.log(`   ❌ Sin coincidencia: ${stats.noMatch}`);
    console.log(`   ⚠️  Identificación duplicada: ${stats.multiMatch}`);
    console.log(
      `   ⚠️  Datos inconsistentes: ${stats.inconsistentData}\n`,
    );

    // Mostrar problemas críticos
    if (report.issues.length > 0) {
      console.log("🚨 PROBLEMAS DETECTADOS:\n");
      report.issues.slice(0, 10).forEach((issue) => {
        console.log(
          `   Fila ${issue.nominaRow}: [${issue.matchType}] ${issue.nominaName} (${issue.nominaId})`,
        );
        console.log(`   └─ ${issue.details}\n`);
      });

      if (report.issues.length > 10) {
        console.log(`   ... y ${report.issues.length - 10} problemas más\n`);
      }
    }

    console.log(`✅ Reporte guardado en: ${reportFile}\n`);

    // Exportar candidatos validados para liquidación
    const validCandidates = matches
      .filter((m) => m.matchType === "MATCH_OK")
      .map((m) => ({
        nominaRowIndex: m.nominaRow,
        employeeId: m.matchedEmployeeIds[0],
        employeeCode: m.matchedEmployeeCodes[0],
        period: "2026-04",
      }));

    const liquidationSetup = {
      executedAt: new Date().toISOString(),
      period: "2026-04",
      validCandidates: validCandidates.length,
      candidates: validCandidates,
    };

    const liquidationFile = path.join("data", "nomina-liquidation-setup.json");
    fs.writeFileSync(liquidationFile, JSON.stringify(liquidationSetup, null, 2));

    console.log(`✅ Setup de liquidación guardado en: ${liquidationFile}\n`);
    console.log("🎯 Próximo paso: Revisar reporte de conciliación y ejecutar modo DRY_RUN\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Error: ${message}\n`);
    process.exit(1);
  }
}

reconcileNominaEmployees()
  .then(() => {
    console.log("✅ Reconciliación completada\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
  });
