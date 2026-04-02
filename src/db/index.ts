import { crmDb } from "./crm";
import { erpDb } from "./erp";
import { iamDb } from "./iam";
import { mesDb } from "./mes";

// Compatibility export: keep `db` pointing to ERP while routes are migrated.
export const db = erpDb;

export { erpDb, mesDb, crmDb, iamDb };
