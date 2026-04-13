/**
 * Apply migration 0081: Add retention switches and stamp columns to prefacturas.
 * Idempotent: uses IF NOT EXISTS so safe to run multiple times.
 */
import { db } from "@/src/db";
import { sql } from "drizzle-orm";

async function run() {
  console.log("[0081] Applying migration: add prefactura retention switches and stamp...");

  await db.execute(sql.raw(`
    ALTER TABLE prefacturas
      ADD COLUMN IF NOT EXISTS rete_fuente_enabled boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS rete_ica_enabled boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS rete_iva_enabled boolean NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS estampilla_enabled boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS estampilla_rate numeric(5,2) NOT NULL DEFAULT 0.5,
      ADD COLUMN IF NOT EXISTS estampilla_amount numeric(14,2) NOT NULL DEFAULT 0
  `));

  console.log("[0081] Columns added (or already existed).");

  await db.execute(sql.raw(`
    UPDATE prefacturas
    SET
      rete_fuente_enabled = COALESCE(rete_fuente_enabled, true),
      rete_ica_enabled = COALESCE(rete_ica_enabled, true),
      rete_iva_enabled = COALESCE(rete_iva_enabled, true),
      estampilla_enabled = COALESCE(estampilla_enabled, false),
      estampilla_rate = COALESCE(estampilla_rate, 0.5),
      estampilla_amount = COALESCE(estampilla_amount, 0)
  `));

  console.log("[0081] Defaults backfilled for existing rows.");

  // Verify columns exist
  const check = await db.execute(sql.raw(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'prefacturas'
      AND column_name IN (
        'rete_fuente_enabled', 'rete_ica_enabled', 'rete_iva_enabled',
        'estampilla_enabled', 'estampilla_rate', 'estampilla_amount'
      )
    ORDER BY column_name
  `));

  console.log("[0081] Column verification:");
  for (const row of check.rows) {
    const r = row as { column_name: string; data_type: string; column_default: string };
    console.log(`  ✅ ${r.column_name} (${r.data_type}, default=${r.column_default})`);
  }

  console.log(`[0081] Done. ${check.rows.length}/6 columns verified.`);
  process.exit(0);
}

run().catch((e) => {
  console.error("[0081] Migration failed:", e);
  process.exit(1);
});
