import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEmployeeRoleReferenceIndex,
  buildEmployeeRoleReferences,
  normalizeEmployeeText,
  resolveCanonicalRoleForEmployee,
} from "@/src/utils/employee-role-normalization";

test("employee role normalization: normaliza nombres con acentos", () => {
  assert.equal(
    normalizeEmployeeText("  Líder   Diseño  "),
    "LIDER DISENO",
  );
});

test("employee role normalization: resuelve por identificacion primero", () => {
  const references = buildEmployeeRoleReferences(
    [
      {
        employeeCode: "EMP0001",
        identification: "123",
        name: "Ana Lopez",
        cargo: "DIRECTOR GRAFICO",
      },
    ],
    () => "LIDER_DISEÑO",
  );

  const match = resolveCanonicalRoleForEmployee(
    {
      employeeCode: "EMP9999",
      identification: "123",
      name: "Otro nombre",
    },
    buildEmployeeRoleReferenceIndex(references),
  );

  assert.equal(match?.canonicalRoleName, "LIDER_DISEÑO");
  assert.equal(match?.matchSource, "identification");
});

test("employee role normalization: resuelve por codigo cuando falta identificacion", () => {
  const references = buildEmployeeRoleReferences(
    [
      {
        employeeCode: "EMP0002",
        identification: "456",
        name: "Luis Perez",
        cargo: "DISEÑADOR GRAFICO",
      },
    ],
    () => "DISEÑADOR",
  );

  const match = resolveCanonicalRoleForEmployee(
    {
      employeeCode: "EMP0002",
      identification: null,
      name: "Luis Perez",
    },
    buildEmployeeRoleReferenceIndex(references),
  );

  assert.equal(match?.canonicalRoleName, "DISEÑADOR");
  assert.equal(match?.matchSource, "employeeCode");
});

test("employee role normalization: no resuelve por nombre ambiguo", () => {
  const references = buildEmployeeRoleReferences(
    [
      {
        employeeCode: "EMP0001",
        identification: "123",
        name: "Ana Lopez",
        cargo: "DIRECTOR GRAFICO",
      },
      {
        employeeCode: "EMP0002",
        identification: "456",
        name: "Ana Lopez",
        cargo: "DISEÑADOR GRAFICO",
      },
    ],
    (cargo) =>
      cargo === "DIRECTOR GRAFICO" ? "LIDER_DISEÑO" : "DISEÑADOR",
  );

  const match = resolveCanonicalRoleForEmployee(
    {
      employeeCode: null,
      identification: null,
      name: "Ana Lopez",
    },
    buildEmployeeRoleReferenceIndex(references),
  );

  assert.equal(match, null);
});