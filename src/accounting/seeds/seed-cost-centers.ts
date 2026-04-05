import "dotenv/config";

import { db } from "@/src/db";
import { accountingCostCenters } from "@/src/db/schema";

const CENTERS = [
  { code: "00", name: "Administrativo", city: "Itagüí" },
  { code: "01", name: "Operaciones Itagüí", city: "Itagüí" },
  { code: "02", name: "Medellín", city: "Medellín" },
  { code: "03", name: "Montería", city: "Montería" },
] as const;

async function runSeedCostCenters() {
  await db
    .insert(accountingCostCenters)
    .values(CENTERS.map((center) => ({ ...center, isActive: true })))
    .onConflictDoNothing();

  console.log("✓ Centros de costo cargados.");
}

runSeedCostCenters()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit();
  });