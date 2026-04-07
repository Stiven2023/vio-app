import "dotenv/config";
import { Client } from "pg";

async function main() {
  const adminClient = new Client({
    user: "postgres",
    password: process.env.DB_PASSWORD || "Dev2026.**",
    host: "localhost",
    port: 5432,
    database: "postgres",
  });

  await adminClient.connect();

  const databases = ["IAM_DB", "ERP_DB", "MES_DB", "CRM_DB"];

  for (const db of databases) {
    try {
      const res = await adminClient.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [db]
      );

      if (res.rows.length === 0) {
        console.log(`Creating database: ${db}`);
        await adminClient.query(`CREATE DATABASE "${db}"`);
        console.log(`✓ Database created: ${db}`);
      } else {
        console.log(`✓ Database exists: ${db}`);
      }
    } catch (error) {
      console.error(`Error processing database ${db}:`, error);
    }
  }

  await adminClient.end();
}

void main();
