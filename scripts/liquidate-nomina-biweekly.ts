/**
 * Script: Biweekly payroll liquidation with DRY_RUN and APPLY modes
 * Purpose: Map validated candidates to HcmLiquidarColillaInput contract, validate with Zod,
 *          calculate preview, and optionally apply to database
 * Usage: pnpm tsx -r dotenv/config scripts/liquidate-nomina-biweekly.ts [--apply]
 */

import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { hcmLiquidarColillaSchema, type HcmLiquidarColillaInput } from "@/src/utils/hcm-contract";
import { liquidarColilla } from "@/src/hcm/services/hcm.service";
import { z } from "zod";

interface NominaRawRow {
  Nombre?: string;
  Cargo?: string;
  CC?: number | string;
  "Salario   $/mes"?: number | string;
  "Auxilio de Transporte"?: number | string;
  "Días laborados en el período"?: number | string;
  [key: string]: unknown;
}

interface LiquidationCandidate {
  nominaRowIndex: number;
  employeeId: string;
  employeeCode: string;
  identification?: string;
  nominaIdentification?: string;
  period: string;
  nominaData: NominaRawRow;
}

interface LiquidationResult {
  success: boolean;
  candidateIndex: number;
  employeeCode: string;
  employeeId: string;
  period: string;
  validationErrors: string[] | null;
  calculatedData?: Partial<HcmLiquidarColillaInput>;
  preview?: {
    salarioBase: number;
    auxilioTransporte: number;
    totalDevengado: number;
    saludEmpleado: number;
    pensionEmpleado: number;
    retencionFuente: number;
    totalDeducciones: number;
    netoAPagar: number;
  };
  error?: string;
}

const CONSTANTES_2025 = {
  SMMLV: 1423500,
  AUXILIO_TRANSPORTE: 200000,
  SALUD_EMPLEADO: 0.04,
  SALUD_EMPLEADOR: 0.085,
  PENSION_EMPLEADO: 0.04,
  PENSION_EMPLEADOR: 0.12,
  CAJA_COMPENSACION: 0.04,
  ICBF: 0.03,
  SENA: 0.02,
};

function toNumber(value: unknown, defaultValue: number = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

function toMoney(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function normalizeId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[.\s-]/g, "")
    .toUpperCase();
}

async function loadNominaData(): Promise<Map<string, NominaRawRow>> {
  const externalPath = "D:\\Programación\\Vio\\BASE NOMINA.xlsx";
  const backupPath = "D:\\Programación\\Vio\\NOMINA BASE.xlsx";

  let filePath = externalPath;
  if (!fs.existsSync(filePath)) {
    filePath = backupPath;
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Documento de nómina no encontrado en: ${externalPath} ni ${backupPath}`);
  }

  const workbook = XLSX.readFile(filePath, { cellFormula: false });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Leer datos
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

  // Construir mapa de datos por identificación normalizada (más robusto que row index)
  const nominaDataByIdentification = new Map<string, NominaRawRow>();

  for (let i = headerRowIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    const rowObj: NominaRawRow = {};

    for (let j = 0; j < row.length; j++) {
      const header = headerMap.get(j);
      if (header) {
        rowObj[header] = row[j];
      }
    }

    const cc = rowObj["CC"];
    if (cc) {
      const normalizedId = String(cc).trim().replace(/[.\s-]/g, "").toUpperCase();
      nominaDataByIdentification.set(normalizedId, rowObj);
    }
  }

  return nominaDataByIdentification;
}

function mapToLiquidationInput(
  candidate: LiquidationCandidate,
  generadoPor: string,
): HcmLiquidarColillaInput {
  const data = candidate.nominaData;

  const salarioBase = toNumber(data["Salario   $/mes"], 0);
  const auxilioTransporte = toNumber(data["Auxilio de Transporte"], 0);
  const horasExtras = toNumber((data as any)["HORAS EXTRAS"] || 0, 0);
  const comisiones = toNumber((data as any)["COMISIONES"] || 0, 0);
  const bonificaciones = toNumber((data as any)["BONIFICACIONES"] || 0, 0);
  const embargos = toNumber((data as any)["EMBARGOS"] || 0, 0);
  const libranzas = toNumber((data as any)["LIBRANZAS"] || 0, 0);

  // Por defecto clase de riesgo 2 si no existe en datos
  const claseRiesgo = toNumber((data as any)["CLASE_RIESGO_ARL"] || 2, 2) as 1 | 2 | 3 | 4 | 5;

  return {
    employeeId: candidate.employeeId,
    period: candidate.period,
    salarioBase,
    horasExtrasValor: horasExtras,
    comisiones,
    bonificaciones,
    vacacionesDisfrutadas: 0,
    embargos,
    libranzas,
    claseRiesgoARL: claseRiesgo,
    generadoPor,
  };
}

function calculatePreview(input: HcmLiquidarColillaInput): NonNullable<LiquidationResult["preview"]> {
  const transporte = input.salarioBase <= CONSTANTES_2025.SMMLV * 2 ? CONSTANTES_2025.AUXILIO_TRANSPORTE : 0;
  const totalDevengado =
    input.salarioBase +
    transporte +
    (input.horasExtrasValor || 0) +
    (input.comisiones || 0) +
    (input.bonificaciones || 0) +
    (input.vacacionesDisfrutadas || 0);

  const saludEmp = input.salarioBase * CONSTANTES_2025.SALUD_EMPLEADO;
  const pensionEmp = input.salarioBase * CONSTANTES_2025.PENSION_EMPLEADO;

  // Retención simplificada (sin detalles UVT)
  const baseRetención = totalDevengado - saludEmp - pensionEmp;
  const retencion = baseRetención > 0 ? baseRetención * 0.05 : 0; // 5% aproximado

  const totalDeducciones =
    saludEmp + pensionEmp + retencion + (input.embargos || 0) + (input.libranzas || 0);
  const netoAPagar = totalDevengado - totalDeducciones;

  return {
    salarioBase: input.salarioBase,
    auxilioTransporte: transporte,
    totalDevengado,
    saludEmpleado: saludEmp,
    pensionEmpleado: pensionEmp,
    retencionFuente: retencion,
    totalDeducciones,
    netoAPagar,
  };
}

async function liquidateBiweeklyPayroll() {
  const isApplyMode = process.argv.includes("--apply");
  const modeLabel = isApplyMode ? "APPLY" : "DRY_RUN";

  console.log(`\n🚀 Iniciando LIQUIDACIÓN de nómina quincenal - Modo: ${modeLabel}\n`);

  try {
    // Leer setup
    const setupPath = path.join("data", "nomina-liquidation-setup.json");
    if (!fs.existsSync(setupPath)) {
      console.error(`❌ Setup no encontrado: ${setupPath}`);
      console.error("   Ejecuta primero: pnpm tsx -r dotenv/config scripts/reconcile-nomina-complete.ts");
      process.exit(1);
    }

    const setupData = JSON.parse(fs.readFileSync(setupPath, "utf-8"));
    const candidates = setupData.candidates as LiquidationCandidate[];

    console.log(`📋 FASE 1: Cargando datos de nómina...\n`);
    const nominaDataByIdent = await loadNominaData();
    console.log(`   ✅ ${nominaDataByIdent.size} registros de nómina cargados\n`);

    console.log(`📋 FASE 2: Mapeando candidatos a contrato de liquidación...\n`);

    const liquidationInputs: Array<LiquidationCandidate & { input: HcmLiquidarColillaInput; nominaData: NominaRawRow }> = [];

    for (const candidate of candidates) {
      // Compatibilidad: reconciliation setup may store either identification or nominaIdentification.
      const candidateIdentification = normalizeId(candidate.identification ?? candidate.nominaIdentification);
      if (!candidateIdentification) {
        console.warn(`   ⚠️  Candidato ${candidate.employeeCode} sin identificación en setup`);
        continue;
      }

      // Buscar por identificación normalizada
      const nominaData = nominaDataByIdent.get(candidateIdentification);
      if (!nominaData) {
        console.warn(`   ⚠️  Identificación ${candidateIdentification} no encontrada en nómina`);
        continue;
      }

      // Para simplificar, usar el mismo campo generadoPor con el employeeId
      const input = mapToLiquidationInput(
        { ...candidate, identification: candidateIdentification, nominaData },
        candidate.employeeId,
      );

      liquidationInputs.push({
        ...candidate,
        nominaData,
        input,
      });
    }

    console.log(`   ✅ ${liquidationInputs.length} candidatos mapeados\n`);

    // Validar con Zod
    console.log(`📋 FASE 3: Validando contra esquema Zod...\n`);

    const validationResults: LiquidationResult[] = [];
    let validCount = 0;
    let invalidCount = 0;

    for (let idx = 0; idx < liquidationInputs.length; idx++) {
      const { input, employeeCode, employeeId, nominaData } = liquidationInputs[idx];

      try {
        const validated = hcmLiquidarColillaSchema.parse(input);
        const preview = calculatePreview(validated);

        const result: LiquidationResult = {
          success: true,
          candidateIndex: idx,
          employeeCode,
          employeeId,
          period: input.period,
          validationErrors: null,
          calculatedData: validated,
          preview,
        };

        validationResults.push(result);
        validCount++;

        // Validaciones comerciales adicionales
        if (preview.netoAPagar < 0) {
          result.success = false;
          result.validationErrors = [`Neto a pagar negativo: ${preview.netoAPagar}`];
          invalidCount++;
        }
      } catch (error) {
        const errors =
          error instanceof z.ZodError
            ? error.issues.map((e: z.ZodIssue) => e.message)
            : [String(error)];

        validationResults.push({
          success: false,
          candidateIndex: idx,
          employeeCode,
          employeeId,
          period: input.period,
          validationErrors: errors,
          error: errors.join("; "),
        });
        invalidCount++;
      }
    }

    console.log(`   ✅ ${validCount} candidatos válidos`);
    console.log(`   ❌ ${invalidCount} candidatos con errores\n`);

    // Mostrar muestra de preview
    console.log(`📋 FASE 4: Preview de cálculos (primeros 5 válidos):\n`);

    const validResults = validationResults.filter((r) => r.success && r.preview);
    validResults.slice(0, 5).forEach((r) => {
      console.log(`   ${r.employeeCode}:`);
      console.log(`      Salario: ${toMoney(r.preview!.salarioBase)} - Transporte: ${toMoney(r.preview!.auxilioTransporte)}`);
      console.log(`      Devengado: ${toMoney(r.preview!.totalDevengado)} - Deducciones: ${toMoney(r.preview!.totalDeducciones)}`);
      console.log(`      💰 Neto: ${toMoney(r.preview!.netoAPagar)}\n`);
    });

    // Guardar reporte de validación
    const reportPath = path.join("data", `nomina-liquidation-${modeLabel}-report.json`);
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          mode: modeLabel,
          executedAt: new Date().toISOString(),
          statistics: {
            totalCandidates: liquidationInputs.length,
            validCandidates: validCount,
            invalid: invalidCount,
          },
          results: validationResults,
        },
        null,
        2,
      ),
      "utf-8",
    );

    console.log(`✅ Reporte guardado: ${reportPath}\n`);

    if (isApplyMode && validCount > 0) {
      console.log(`📋 FASE 5: Aplicando liquidación a base de datos...\n`);

      let liquidatedCount = 0;
      let errorCount = 0;

      for (const result of validResults) {
        try {
          const input = liquidationInputs.find((l) => l.employeeCode === result.employeeCode)?.input;
          if (!input) continue;

          await liquidarColilla(input);
          liquidatedCount++;
          console.log(`   ✅ ${result.employeeCode} liquidada`);
        } catch (error) {
          errorCount++;
          console.log(`   ❌ ${result.employeeCode}: ${error}`);
        }
      }

      console.log(`\n✅ Liquidación completada: ${liquidatedCount} OK, ${errorCount} errores\n`);
    } else if (!isApplyMode) {
      console.log(`✅ Modo DRY_RUN completado. Para aplicar cambios, ejecuta:\n`);
      console.log(`   pnpm tsx -r dotenv/config scripts/liquidate-nomina-biweekly.ts --apply\n`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Error: ${message}\n`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

liquidateBiweeklyPayroll()
  .then(() => {
    console.log("✅ Proceso completado\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
  });
