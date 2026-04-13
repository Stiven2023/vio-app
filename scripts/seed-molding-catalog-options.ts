import { db } from "@/src/db";
import { moldingCatalogOptions } from "@/src/db/schema";

async function seedCatalogOptions() {
  const seedData = [
    // tipoAplique
    { fieldKey: "tipoAplique", value: "NO", label: "Sin aplique", sortOrder: 0 },
    { fieldKey: "tipoAplique", value: "DTF", label: "DTF", sortOrder: 1 },
    { fieldKey: "tipoAplique", value: "VINILO", label: "Vinilo", sortOrder: 2 },

    // embroideryTechnique
    { fieldKey: "embroideryTechnique", value: "NO", label: "Sin bordado", sortOrder: 0 },
    { fieldKey: "embroideryTechnique", value: "HILO", label: "Hilo", sortOrder: 1 },
    { fieldKey: "embroideryTechnique", value: "APLIQUE", label: "Aplique", sortOrder: 2 },

    // marquillaType
    { fieldKey: "marquillaType", value: "NO", label: "Sin marquilla", sortOrder: 0 },
    { fieldKey: "marquillaType", value: "VIOMAR", label: "Viomar", sortOrder: 1 },
    { fieldKey: "marquillaType", value: "CLIENTE", label: "Del cliente", sortOrder: 2 },

    // neckType
    { fieldKey: "neckType", value: "CUELLO REDONDO", label: "Cuello redondo", sortOrder: 0 },
    { fieldKey: "neckType", value: "CUELLO EN V", label: "Cuello en V", sortOrder: 1 },
    { fieldKey: "neckType", value: "CUELLO MILITAR", label: "Cuello militar", sortOrder: 2 },
    { fieldKey: "neckType", value: "CUELLO TIPO POLO", label: "Cuello tipo polo", sortOrder: 3 },
    { fieldKey: "neckType", value: "CUELLO TORTUGA", label: "Cuello tortuga", sortOrder: 4 },
    { fieldKey: "neckType", value: "OTRO", label: "Otro", sortOrder: 5 },

    // sesgoType
    { fieldKey: "sesgoType", value: "SESGO SOBREPUESTO 4.5CM", label: "Sesgo sobrepuesto 4.5 cm", sortOrder: 0 },
    { fieldKey: "sesgoType", value: "SESGO NORMAL 3.5CM", label: "Sesgo normal 3.5 cm", sortOrder: 1 },
    { fieldKey: "sesgoType", value: "SESGO INTERNO", label: "Sesgo interno", sortOrder: 2 },
    { fieldKey: "sesgoType", value: "SIN SESGO", label: "Sin sesgo", sortOrder: 3 },
    { fieldKey: "sesgoType", value: "OTRO", label: "Otro", sortOrder: 4 },

    // sleeveType
    { fieldKey: "sleeveType", value: "MANGA CORTA", label: "Manga corta", sortOrder: 0 },
    { fieldKey: "sleeveType", value: "MANGA LARGA", label: "Manga larga", sortOrder: 1 },
    { fieldKey: "sleeveType", value: "SIN MANGA", label: "Sin manga", sortOrder: 2 },

    // cuffType
    { fieldKey: "cuffType", value: "NO APLICA", label: "No aplica", sortOrder: 0 },
    { fieldKey: "cuffType", value: "RIB", label: "Rib", sortOrder: 1 },
    { fieldKey: "cuffType", value: "PUÑO TEJIDO", label: "Puño tejido", sortOrder: 2 },
    { fieldKey: "cuffType", value: "PUÑO EN LA MISMA TELA", label: "Puño en la misma tela", sortOrder: 3 },

    // liningType
    { fieldKey: "liningType", value: "SIN FORRO", label: "Sin forro", sortOrder: 0 },
    { fieldKey: "liningType", value: "MALLA", label: "Malla", sortOrder: 1 },
    { fieldKey: "liningType", value: "POLAR", label: "Polar", sortOrder: 2 },
    { fieldKey: "liningType", value: "TAFETA", label: "Tafeta", sortOrder: 3 },
    { fieldKey: "liningType", value: "OTRO", label: "Otro", sortOrder: 4 },

    // hoodType
    { fieldKey: "hoodType", value: "SIN CAPUCHA", label: "Sin capucha", sortOrder: 0 },
    { fieldKey: "hoodType", value: "FIJA", label: "Fija", sortOrder: 1 },
    { fieldKey: "hoodType", value: "DESMONTABLE", label: "Desmontable", sortOrder: 2 },
    { fieldKey: "hoodType", value: "GUARDABLE", label: "Guardable", sortOrder: 3 },

    // buttonType
    { fieldKey: "buttonType", value: "SIN BOTONES", label: "Sin botones", sortOrder: 0 },
    { fieldKey: "buttonType", value: "2 BOTONES", label: "2 botones", sortOrder: 1 },
    { fieldKey: "buttonType", value: "3 BOTONES", label: "3 botones", sortOrder: 2 },
    { fieldKey: "buttonType", value: "BROCHE", label: "Broche", sortOrder: 3 },
    { fieldKey: "buttonType", value: "OTRO", label: "Otro", sortOrder: 4 },

    // buttonholeType
    { fieldKey: "buttonholeType", value: "SIN OJAL", label: "Sin ojal", sortOrder: 0 },
    { fieldKey: "buttonholeType", value: "SENCILLO", label: "Sencillo", sortOrder: 1 },
    { fieldKey: "buttonholeType", value: "REFORZADO", label: "Reforzado", sortOrder: 2 },
    { fieldKey: "buttonholeType", value: "OTRO", label: "Otro", sortOrder: 3 },

    // pocketConfig
    { fieldKey: "pocketConfig", value: "SIN BOLSILLOS", label: "Sin bolsillos", sortOrder: 0 },
    { fieldKey: "pocketConfig", value: "EN EL PECHO", label: "En el pecho", sortOrder: 1 },
    { fieldKey: "pocketConfig", value: "BOLSILLOS LATERALES", label: "Bolsillos laterales", sortOrder: 2 },
    { fieldKey: "pocketConfig", value: "BOLSILLOS LATERALES + BOLSILLO TRASERO", label: "Bolsillos laterales + bolsillo trasero", sortOrder: 3 },
  ];

  let inserted = 0;
  let skipped = 0;

  for (const item of seedData) {
    try {
      await db.insert(moldingCatalogOptions).values({
        fieldKey: item.fieldKey,
        value: item.value,
        label: item.label || null,
        sortOrder: item.sortOrder,
        isActive: true,
      });
      inserted++;
    } catch (err) {
      const msg = String(err);
      if (msg.includes("duplicate") || msg.includes("already exists")) {
        skipped++;
      } else {
        console.error(`✗ Error inserting ${item.fieldKey}/${item.value}:`, msg.substring(0, 100));
        throw err;
      }
    }
  }

  console.log(`✓ Seed complete: ${inserted} inserted, ${skipped} skipped`);
  return { inserted, skipped };
}

seedCatalogOptions()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("✗ Seeding failed:", err);
    process.exit(1);
  });
