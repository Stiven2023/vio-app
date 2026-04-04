import "dotenv/config";

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

import { activeEmployees, resolveRoleName } from "@/db/seeds/employees-users.seed";
import {
  buildEmployeeRoleReferenceIndex,
  buildEmployeeRoleReferences,
  resolveCanonicalRoleForEmployee,
} from "@/src/utils/employee-role-normalization";
import { isLegacyMigratedRole } from "@/src/utils/legacy-roles";

type LegacyEmployeeDbRow = {
  id: string;
  employeeCode: string;
  identification: string;
  name: string;
  roleId: string | null;
  roleName: string | null;
  isActive: boolean | null;
};

function getOutFile() {
  const arg = process.argv.find((value) => value.startsWith("--out="));

  if (!arg) {
    return null;
  }

  return path.resolve(arg.slice("--out=".length));
}

async function loadLegacyEmployees(client: Client): Promise<LegacyEmployeeDbRow[]> {
  const result = await client.query<{
    id: string;
    employee_code: string;
    identification: string;
    name: string;
    role_id: string | null;
    role_name: string | null;
    is_active: boolean | null;
  }>(`
    select
      e.id,
      e.employee_code,
      e.identification,
      e.name,
      e.role_id,
      r.name as role_name,
      e.is_active
    from employees e
    left join roles r on r.id = e.role_id
    where r.name like 'LEGACY_MIGRATED_ROLE_%'
    order by r.name asc, e.employee_code asc;
  `);

  return result.rows.map((row) => ({
    id: row.id,
    employeeCode: row.employee_code,
    identification: row.identification,
    name: row.name,
    roleId: row.role_id,
    roleName: row.role_name,
    isActive: row.is_active,
  }));
}

async function main() {
  const connectionString = process.env.ERP_DATABASE_URL;

  if (!connectionString) {
    throw new Error("ERP_DATABASE_URL missing");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const references = buildEmployeeRoleReferences(activeEmployees, resolveRoleName);
    const referenceIndex = buildEmployeeRoleReferenceIndex(references);
    const legacyEmployees = await loadLegacyEmployees(client);

    const grouped = new Map<string, any[]>();
    const unresolved: LegacyEmployeeDbRow[] = [];

    for (const employee of legacyEmployees) {
      const match = resolveCanonicalRoleForEmployee(employee, referenceIndex);

      if (!match) {
        unresolved.push(employee);
      }

      const roleName = String(employee.roleName ?? "SIN_ROL");
      const current = grouped.get(roleName) ?? [];

      current.push({
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        identification: employee.identification,
        name: employee.name,
        currentRoleId: employee.roleId,
        currentRoleName: employee.roleName,
        isLegacyRole: isLegacyMigratedRole(employee.roleName),
        isActive: employee.isActive,
        canonicalRoleName: match?.canonicalRoleName ?? null,
        matchSource: match?.matchSource ?? null,
        referenceCargo: match?.reference.cargo ?? null,
      });

      grouped.set(roleName, current);
    }

    const inventory = {
      generatedAt: new Date().toISOString(),
      totalLegacyEmployees: legacyEmployees.length,
      unresolvedEmployees: unresolved,
      roles: [...grouped.entries()].map(([roleName, employees]) => ({
        legacyRoleName: roleName,
        totalEmployees: employees.length,
        canonicalRolesDetected: [...new Set(
          employees
            .map((employee) => employee.canonicalRoleName)
            .filter(Boolean),
        )],
        employees,
      })),
    };

    const outFile = getOutFile();

    if (outFile) {
      await writeFile(outFile, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
      console.log(`Inventario escrito en ${outFile}`);
    }

    console.log(JSON.stringify(inventory, null, 2));
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});