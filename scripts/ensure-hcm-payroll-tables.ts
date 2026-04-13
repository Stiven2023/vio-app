/**
 * Ensure required HCM payroll tables/enums exist in ERP database.
 * Safe/idempotent: only creates missing enums/tables/indexes.
 *
 * Usage:
 *   pnpm tsx scripts/ensure-hcm-payroll-tables.ts
 */

import { sql } from "drizzle-orm";
import { db } from "@/src/db";

async function ensurePayrollSchema() {
  console.log("\n[ensure-hcm-payroll] Ensuring enums and tables...\n");

  await db.execute(sql.raw(`
DO $$
BEGIN
  CREATE TYPE colilla_status AS ENUM ('BORRADOR', 'LIQUIDADA', 'PAGADA', 'CONTABILIZADA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`));

  await db.execute(sql.raw(`
DO $$
BEGIN
  CREATE TYPE hcm_pre_asiento_status AS ENUM ('PENDIENTE', 'APROBADO', 'CONTABILIZADO', 'RECHAZADO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`));

  await db.execute(sql.raw(`
CREATE TABLE IF NOT EXISTS colillas_pago (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id),
  period varchar(7) NOT NULL,
  status colilla_status NOT NULL DEFAULT 'BORRADOR',
  salario_basico numeric(14,2) NOT NULL,
  auxilio_transporte numeric(12,2) NOT NULL DEFAULT 0,
  comisiones numeric(14,2) NOT NULL DEFAULT 0,
  total_devengado numeric(14,2) NOT NULL,
  salud_empleado numeric(12,2) NOT NULL,
  pension_empleado numeric(12,2) NOT NULL,
  retencion_fuente numeric(12,2) NOT NULL DEFAULT 0,
  total_deducciones numeric(14,2) NOT NULL,
  neto_a_pagar numeric(14,2) NOT NULL,
  accounting_entry_id uuid,
  pdf_url text,
  generado_por uuid REFERENCES employees(id),
  pagado_en timestamptz,
  bank_id uuid REFERENCES banks(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
`));

  await db.execute(sql.raw(`
CREATE UNIQUE INDEX IF NOT EXISTS colillas_pago_employee_period_unique
  ON colillas_pago (employee_id, period);
`));

  await db.execute(sql.raw(`
CREATE INDEX IF NOT EXISTS colillas_pago_status_idx
  ON colillas_pago (status);
`));

  await db.execute(sql.raw(`
CREATE TABLE IF NOT EXISTS hcm_pre_asientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origen varchar(40) NOT NULL,
  origen_id uuid NOT NULL,
  employee_id uuid NOT NULL REFERENCES employees(id),
  period varchar(7) NOT NULL,
  cuenta_debito varchar(20) NOT NULL,
  cuenta_credito varchar(20) NOT NULL,
  valor numeric(14,2) NOT NULL,
  concepto text NOT NULL,
  status hcm_pre_asiento_status NOT NULL DEFAULT 'PENDIENTE',
  accounting_entry_id uuid,
  aprobado_por uuid REFERENCES employees(id),
  aprobado_en timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
`));

  await db.execute(sql.raw(`
CREATE INDEX IF NOT EXISTS hcm_pre_asientos_origen_idx
  ON hcm_pre_asientos (origen, origen_id);
`));

  await db.execute(sql.raw(`
CREATE INDEX IF NOT EXISTS hcm_pre_asientos_status_idx
  ON hcm_pre_asientos (status);
`));

  await db.execute(sql.raw(`
CREATE INDEX IF NOT EXISTS hcm_pre_asientos_period_idx
  ON hcm_pre_asientos (period);
`));

  const colillasCheck = await db.execute(sql.raw(`
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'colillas_pago'
) AS exists;
`));

  const preAsientosCheck = await db.execute(sql.raw(`
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'hcm_pre_asientos'
) AS exists;
`));

  console.log("[ensure-hcm-payroll] colillas_pago exists:", colillasCheck.rows[0]);
  console.log("[ensure-hcm-payroll] hcm_pre_asientos exists:", preAsientosCheck.rows[0]);
  console.log("\n[ensure-hcm-payroll] Done.\n");
}

ensurePayrollSchema().catch((error) => {
  console.error("[ensure-hcm-payroll] Failed:", error);
  process.exit(1);
});
