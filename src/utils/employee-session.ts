import { eq, or } from "drizzle-orm";

import { erpDb } from "@/src/db";
import { employees, roles } from "@/src/db/erp/schema";
import {
  resolveEmployeeRole,
  type EmployeeRoleResolution,
  type EmployeeRoleResolutionCode,
} from "@/src/utils/employee-role-resolution";

type EmployeeIdentityInput = {
  employeeId?: string | null;
  userId?: string | null;
  email?: string | null;
};

export type ResolvedEmployeeIdentity = {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  roleId: string | null;
  roleName: string | null;
  employeeImageUrl: string | null;
};

export { resolveEmployeeRole };
export type { EmployeeRoleResolution, EmployeeRoleResolutionCode };

function normalizeEmail(email: string | null | undefined) {
  const normalized = String(email ?? "").trim().toLowerCase();

  return normalized !== "" ? normalized : null;
}

async function resolveRoleName(roleId: string | null) {
  if (!roleId) {
    return null;
  }

  const [role] = await erpDb
    .select({ name: roles.name })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);

  return role?.name ?? null;
}

export async function resolveEmployeeIdentity(
  input: EmployeeIdentityInput,
): Promise<ResolvedEmployeeIdentity | null> {
  const normalizedEmail = normalizeEmail(input.email);
  const employeeId = String(input.employeeId ?? "").trim();
  const userId = String(input.userId ?? "").trim();

  let employee = null as
    | {
        id: string;
        userId: string | null;
        name: string;
        email: string;
        roleId: string | null;
        employeeImageUrl: string | null;
      }
    | null;

  if (employeeId) {
    [employee] = await erpDb
      .select({
        id: employees.id,
        userId: employees.userId,
        name: employees.name,
        email: employees.email,
        roleId: employees.roleId,
        employeeImageUrl: employees.employeeImageUrl,
      })
      .from(employees)
      .where(eq(employees.id, employeeId))
      .limit(1);
  }

  if (!employee && userId && normalizedEmail) {
    [employee] = await erpDb
      .select({
        id: employees.id,
        userId: employees.userId,
        name: employees.name,
        email: employees.email,
        roleId: employees.roleId,
        employeeImageUrl: employees.employeeImageUrl,
      })
      .from(employees)
      .where(or(eq(employees.userId, userId), eq(employees.email, normalizedEmail)))
      .limit(1);
  }

  if (!employee && userId) {
    [employee] = await erpDb
      .select({
        id: employees.id,
        userId: employees.userId,
        name: employees.name,
        email: employees.email,
        roleId: employees.roleId,
        employeeImageUrl: employees.employeeImageUrl,
      })
      .from(employees)
      .where(eq(employees.userId, userId))
      .limit(1);
  }

  if (!employee && normalizedEmail) {
    [employee] = await erpDb
      .select({
        id: employees.id,
        userId: employees.userId,
        name: employees.name,
        email: employees.email,
        roleId: employees.roleId,
        employeeImageUrl: employees.employeeImageUrl,
      })
      .from(employees)
      .where(eq(employees.email, normalizedEmail))
      .limit(1);
  }

  if (!employee) {
    return null;
  }

  return {
    ...employee,
    roleName: await resolveRoleName(employee.roleId ?? null),
  };
}