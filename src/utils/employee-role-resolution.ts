export type EmployeeRoleSnapshot = {
  roleId: string | null;
  roleName: string | null;
};

export type EmployeeRoleResolutionCode =
  | "EMPLOYEE_NOT_FOUND"
  | "EMPLOYEE_ROLE_NOT_ASSIGNED"
  | "EMPLOYEE_ROLE_NOT_FOUND";

export type EmployeeRoleResolution = {
  role: string | null;
  code: EmployeeRoleResolutionCode | null;
};

export function resolveEmployeeRole(
  employee: EmployeeRoleSnapshot | null,
  fallbackRole?: string | null,
): EmployeeRoleResolution {
  const normalizedFallback = String(fallbackRole ?? "").trim();

  if (normalizedFallback !== "") {
    return { role: normalizedFallback, code: null };
  }

  if (!employee) {
    return { role: null, code: "EMPLOYEE_NOT_FOUND" };
  }

  if (!employee.roleId) {
    return { role: null, code: "EMPLOYEE_ROLE_NOT_ASSIGNED" };
  }

  if (!employee.roleName) {
    return { role: null, code: "EMPLOYEE_ROLE_NOT_FOUND" };
  }

  return { role: employee.roleName, code: null };
}