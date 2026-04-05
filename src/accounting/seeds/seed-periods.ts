import "dotenv/config";

import { db } from "@/src/db";
import { accountingPeriods } from "@/src/db/schema";

function firstDay(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
}

function lastDay(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).toISOString();
}

async function runSeedPeriods() {
  const rows: Array<typeof accountingPeriods.$inferInsert> = [];

  for (const year of [2024, 2025, 2026]) {
    for (let month = 1; month <= 12; month += 1) {
      const period = `${year}-${String(month).padStart(2, "0")}`;
      const isOpen = year === 2026;

      rows.push({
        period,
        status: isOpen ? "OPEN" : "BLOCKED",
        closureType: "MENSUAL",
        openedAt: new Date(firstDay(year, month)),
        closedAt: isOpen ? null : new Date(lastDay(year, month)),
        closeReason: isOpen ? null : "Período histórico bloqueado por seed inicial contable.",
      });
    }
  }

  await db.insert(accountingPeriods).values(rows).onConflictDoNothing();

  console.log(`✓ ${rows.length} períodos creados.`);
}

runSeedPeriods()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit();
  });