import "dotenv/config";

import { Client } from "pg";

import { activeEmployees, resolveRoleName } from "@/db/seeds/employees-users.seed";
import { ROLE_PERMISSIONS } from "@/src/db/role-permissions-map";
import {
  buildEmployeeRoleReferenceIndex,
  buildEmployeeRoleReferences,
  resolveCanonicalRoleForEmployee,
} from "@/src/utils/employee-role-normalization";

type LegacyEmployeeDbRow = {
  id: string;
  employeeCode: string;
  identification: string;
  name: string;
  roleId: string | null;
  roleName: string | null;
};

function isApplyMode() {
  return process.argv.includes("--apply");
}

async function loadLegacyEmployees(client: Client): Promise<LegacyEmployeeDbRow[]> {
  const result = await client.query<{
    id: string;
    employee_code: string;
    identification: string;
    name: string;
    role_id: string | null;
    role_name: string | null;
  }>(`
    select
      e.id,
      e.employee_code,
      e.identification,
      e.name,
      e.role_id,
      r.name as role_name
    from employees e
    left join roles r on r.id = e.role_id
    where r.name like 'LEGACY_MIGRATED_ROLE_%'
    order by e.employee_code asc;
  `);

  return result.rows.map((row) => ({
    id: row.id,
    employeeCode: row.employee_code,
    identification: row.identification,
    name: row.name,
    roleId: row.role_id,
    roleName: row.role_name,
  }));
}

async function ensureCanonicalRole(client: Client, roleName: string) {
  const existing = await client.query<{ id: string }>(
    `select id from roles where name = $1 limit 1`,
    [roleName],
  );

  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }

  const inserted = await client.query<{ id: string }>(
    `insert into roles (name) values ($1) returning id`,
    [roleName],
  );

  return inserted.rows[0].id;
}

function getConfiguredPermissionNames() {
  return [...new Set(
    Object.values(ROLE_PERMISSIONS)
      .flatMap((permissions) => (permissions === "ALL" ? [] : permissions)),
  )].sort();
}

async function ensurePermissionsCatalog(client: Client) {
  const configuredPermissionNames = getConfiguredPermissionNames();

  for (const permissionName of configuredPermissionNames) {
    await client.query(
      `
        insert into permissions (name)
        values ($1)
        on conflict (name) do nothing
      `,
      [permissionName],
    );
  }
}

async function ensureRolePermissions(client: Client, roleId: string, roleName: string) {
  const configured = ROLE_PERMISSIONS[roleName];

  if (!configured) {
    throw new Error(`No hay permisos configurados para el rol canónico ${roleName}`);
  }

  const permissionNames =
    configured === "ALL"
      ? (
          await client.query<{ name: string }>(`select name from permissions order by name asc`)
        ).rows.map((row) => row.name)
      : configured;

  if (permissionNames.length === 0) {
    return;
  }

  const permissions = await client.query<{ id: string; name: string }>(
    `select id, name from permissions where name = any($1::text[])`,
    [permissionNames],
  );

  const permissionIdByName = new Map(
    permissions.rows.map((row) => [row.name, row.id]),
  );
  const missingPermissions = permissionNames.filter(
    (permissionName) => !permissionIdByName.has(permissionName),
  );

  if (missingPermissions.length > 0) {
    throw new Error(
      `Faltan permisos para ${roleName}: ${missingPermissions.join(", ")}`,
    );
  }

  for (const permissionName of permissionNames) {
    const permissionId = permissionIdByName.get(permissionName);

    await client.query(
      `
        insert into role_permissions (role_id, permission_id)
        values ($1, $2)
        on conflict (role_id, permission_id) do nothing
      `,
      [roleId, permissionId],
    );
  }
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
    const unresolved = legacyEmployees.filter(
      (employee) => !resolveCanonicalRoleForEmployee(employee, referenceIndex),
    );

    if (unresolved.length > 0) {
      throw new Error(
        `Hay ${unresolved.length} empleados legacy sin mapeo automático. Ejecuta primero el inventario y completa el catálogo antes de aplicar.`,
      );
    }

    const updates = legacyEmployees.map((employee) => {
      const match = resolveCanonicalRoleForEmployee(employee, referenceIndex);

      if (!match) {
        throw new Error(`Empleado sin mapeo: ${employee.employeeCode}`);
      }

      return {
        ...employee,
        canonicalRoleName: match.canonicalRoleName,
        matchSource: match.matchSource,
      };
    });

    const summary = {
      totalLegacyEmployees: updates.length,
      canonicalRoles: [...new Set(updates.map((row) => row.canonicalRoleName))],
      updates: updates.map((row) => ({
        employeeCode: row.employeeCode,
        identification: row.identification,
        name: row.name,
        currentRoleName: row.roleName,
        canonicalRoleName: row.canonicalRoleName,
        matchSource: row.matchSource,
      })),
      mode: isApplyMode() ? "apply" : "dry-run",
    };

    if (!isApplyMode()) {
      console.log(JSON.stringify(summary, null, 2));

      return;
    }

    await client.query("begin");

    try {
      await ensurePermissionsCatalog(client);

      const canonicalRoleIdByName = new Map<string, string>();

      for (const roleName of summary.canonicalRoles) {
        const roleId = await ensureCanonicalRole(client, roleName);

        await ensureRolePermissions(client, roleId, roleName);
        canonicalRoleIdByName.set(roleName, roleId);
      }

      for (const row of updates) {
        const canonicalRoleId = canonicalRoleIdByName.get(row.canonicalRoleName);

        if (!canonicalRoleId) {
          throw new Error(`No se pudo resolver roleId para ${row.canonicalRoleName}`);
        }

        await client.query(`update employees set role_id = $1 where id = $2`, [
          canonicalRoleId,
          row.id,
        ]);
      }

      await client.query("commit");
      console.log(JSON.stringify(summary, null, 2));
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});