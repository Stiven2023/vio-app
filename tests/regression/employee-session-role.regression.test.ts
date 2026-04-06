import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveEmployeeRole,
  type EmployeeRoleSnapshot,
} from "@/src/utils/employee-role-resolution";

function buildEmployee(overrides?: Partial<EmployeeRoleSnapshot>): EmployeeRoleSnapshot {
  return {
    roleId: "role-1",
    roleName: "ADMINISTRADOR",
    ...overrides,
  };
}

test("employee session role: usa fallback role cuando ya viene resuelto en sesión", () => {
  const result = resolveEmployeeRole(null, "OPERARIO_PLOTTER");

  assert.equal(result.role, "OPERARIO_PLOTTER");
  assert.equal(result.code, null);
});

test("employee session role: reporta empleado no encontrado", () => {
  const result = resolveEmployeeRole(null, null);

  assert.equal(result.role, null);
  assert.equal(result.code, "EMPLOYEE_NOT_FOUND");
});

test("employee session role: reporta roleId no asignado", () => {
  const result = resolveEmployeeRole(buildEmployee({ roleId: null, roleName: null }));

  assert.equal(result.role, null);
  assert.equal(result.code, "EMPLOYEE_ROLE_NOT_ASSIGNED");
});

test("employee session role: reporta roleId roto cuando falta roleName", () => {
  const result = resolveEmployeeRole(buildEmployee({ roleName: null }));

  assert.equal(result.role, null);
  assert.equal(result.code, "EMPLOYEE_ROLE_NOT_FOUND");
});