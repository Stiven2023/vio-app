import { db } from "@/src/db";
import { sql } from "drizzle-orm";
import fs from "fs";

async function main() {
  try {
    const migrationContent = fs.readFileSync(
      "drizzle/erp/0002_molding_catalog_options.sql",
      "utf-8",
    );

    // Split by statement-breakpoint comment
    const statements = migrationContent
      .split("--> statement-breakpoint")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt && !stmt.startsWith("--"));

    let executed = 0;
    let skipped = 0;

    for (const statement of statements) {
      if (statement.length < 10) continue;
      console.log(`Executing: ${statement.substring(0, 60)}...`);

      try {
        await db.execute(sql.raw(statement));
        executed++;
        console.log(`  ✓ Success`);
      } catch (err) {
        const errMsg = String(err);
        if (errMsg.includes("already exists")) {
          skipped++;
          console.log(`  ⊘ Already exists (skipped)`);
        } else {
          console.error(`  ✗ Error: ${errMsg.substring(0, 150)}`);
          throw err;
        }
      }
    }

    console.log(`\n✓ Migration complete: ${executed} executed, ${skipped} skipped`);
    process.exit(0);
  } catch (err) {
    console.error("✗ Migration failed:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
