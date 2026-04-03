import "dotenv/config";

import { Client } from "pg";
import * as schema from "../src/db/schema";

type EnumSpec = {
  typeName: string;
  labels: readonly string[];
};

function collectSchemaEnumSpecs(): EnumSpec[] {
  const specsByName = new Map<string, EnumSpec>();

  for (const value of Object.values(schema)) {
    if (
      typeof value !== "function" ||
      !("enumName" in value) ||
      !("enumValues" in value)
    ) {
      continue;
    }

    const enumName = (value as { enumName?: unknown }).enumName;
    const enumValues = (value as { enumValues?: unknown }).enumValues;

    if (
      typeof enumName !== "string" ||
      !Array.isArray(enumValues) ||
      enumValues.length === 0 ||
      !enumValues.every((item) => typeof item === "string")
    ) {
      continue;
    }

    if (!specsByName.has(enumName)) {
      specsByName.set(enumName, {
        typeName: enumName,
        labels: enumValues as string[],
      });
    }
  }

  return [...specsByName.values()].sort((a, b) =>
    a.typeName.localeCompare(b.typeName),
  );
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function buildEnsureEnumSql(typeName: string, labels: readonly string[]): string {
  const safeType = escapeSqlLiteral(typeName);
  const createLabels = labels
    .map((label) => `'${escapeSqlLiteral(label)}'`)
    .join(",\n      ");

  const addValueBlocks = labels
    .map((label) => {
      const safeLabel = escapeSqlLiteral(label);
      return `
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = '${safeType}'
      AND n.nspname = 'public'
      AND e.enumlabel = '${safeLabel}'
  ) THEN
    ALTER TYPE public."${typeName}" ADD VALUE '${safeLabel}';
  END IF;`;
    })
    .join("\n");

  return `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = '${safeType}'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public."${typeName}" AS ENUM (
      ${createLabels}
    );
  END IF;
${addValueBlocks}
END
$$;
`;
}

async function main() {
  const url = process.env.ERP_DATABASE_URL;

  if (!url) {
    throw new Error("ERP_DATABASE_URL missing");
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const enumSpecs = collectSchemaEnumSpecs();

  for (const spec of enumSpecs) {
    await client.query(buildEnsureEnumSql(spec.typeName, spec.labels));
  }

  await client.end();
  console.log(`erp enums ensured: ${enumSpecs.map((spec) => spec.typeName).join(", ")}`);
}

void main();
