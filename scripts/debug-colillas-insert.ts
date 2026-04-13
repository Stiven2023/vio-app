/**
 * Debug script: test one colillas_pago insert to reveal the actual DB error.
 * Usage: pnpm tsx -r dotenv/config scripts/debug-colillas-insert.ts
 */
import { db } from "@/src/db";
import { colillasPago } from "@/src/db/erp/schema";
import { sql } from "drizzle-orm";

async function run() {
  // 1) Verify table exists
  try {
    const tables = await db.execute(
      sql`SELECT table_name FROM information_schema.tables
          WHERE table_schema='public' AND table_name='colillas_pago'`,
    );
    console.log("colillas_pago table found:", tables.rows.length > 0);
  } catch (e: unknown) {
    console.error("Error checking table existence:", e);
  }

  // 2) Fetch one employee id from DB
  let employeeId: string | null = null;
  try {
    const rows = await db.execute(
      sql`SELECT id FROM employees WHERE is_active = true LIMIT 1`,
    );
    employeeId = (rows.rows[0] as { id: string } | undefined)?.id ?? null;
    console.log("Sample employeeId:", employeeId);
  } catch (e: unknown) {
    console.error("Error fetching employee:", e);
    process.exit(1);
  }

  if (!employeeId) {
    console.error("No active employee found");
    process.exit(1);
  }

  // 3) Try the actual insert
  try {
    const [row] = await db
      .insert(colillasPago)
      .values({
        employeeId,
        period: "2026-04",
        status: "BORRADOR",
        salarioBasico: "1000000.00",
        auxilioTransporte: "200000.00",
        comisiones: "0.00",
        totalDevengado: "1200000.00",
        saludEmpleado: "40000.00",
        pensionEmpleado: "40000.00",
        retencionFuente: "0.00",
        totalDeducciones: "80000.00",
        netoAPagar: "1120000.00",
        generadoPor: employeeId,
        bankId: null,
      })
      .onConflictDoUpdate({
        target: [colillasPago.employeeId, colillasPago.period],
        set: {
          netoAPagar: "1120000.00",
          updatedAt: new Date(),
        },
      })
      .returning({ id: colillasPago.id });

    console.log("✅ Insert OK, id:", row?.id);

    // Cleanup
    await db.execute(
      sql`DELETE FROM colillas_pago WHERE employee_id = ${employeeId} AND period = '2026-04'`,
    );
    console.log("✅ Cleanup done");
  } catch (e: unknown) {
    const err = e as Error & { cause?: Error };
    console.error("❌ Insert failed:", err.message);
    if (err.cause) {
      console.error("Root cause:", err.cause.message ?? err.cause);
    }
  }

  process.exit(0);
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
