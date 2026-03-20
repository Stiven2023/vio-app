import "dotenv/config";

import { db } from "@/src/db";
import { taxZoneRates } from "@/src/db/schema";

const ROWS = [
  {
    taxZone: "CONTINENTAL" as const,
    withholdingTaxRate: "2.5000",
    withholdingIcaRate: "0.9660",
    withholdingIvaRate: "15.0000",
  },
  {
    taxZone: "FREE_ZONE" as const,
    withholdingTaxRate: "1.0000",
    withholdingIcaRate: "0.5000",
    withholdingIvaRate: "0.0000",
  },
  {
    taxZone: "SAN_ANDRES" as const,
    withholdingTaxRate: "0.0000",
    withholdingIcaRate: "0.0000",
    withholdingIvaRate: "0.0000",
  },
  {
    taxZone: "SPECIAL_REGIME" as const,
    withholdingTaxRate: "1.5000",
    withholdingIcaRate: "0.4140",
    withholdingIvaRate: "0.0000",
  },
];

export default async function runSeed() {
  for (const row of ROWS) {
    await db.insert(taxZoneRates).values(row).onConflictDoNothing();
  }
}

if (require.main === module) {
  runSeed()
    .then(() => {
      console.log("Seed tax_zone_rates ejecutado");
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
