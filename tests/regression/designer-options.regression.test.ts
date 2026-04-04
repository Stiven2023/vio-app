import assert from "node:assert/strict";
import test from "node:test";

import {
  filterDesignerOptions,
  isDesignerAssignableRole,
  isLegacyMigratedRole,
} from "@/app/erp/orders/_lib/designer-options";

test("designer options: reconoce roles de diseñador con acentos y separadores", () => {
  assert.equal(isDesignerAssignableRole("DISEÑADOR"), true);
  assert.equal(isDesignerAssignableRole("LIDER_DISEÑO"), true);
  assert.equal(isDesignerAssignableRole("lider diseño"), true);
  assert.equal(isDesignerAssignableRole("ADMINISTRADOR"), false);
});

test("designer options: filtra solo empleados asignables a diseño", () => {
  const filtered = filterDesignerOptions([
    { id: "1", name: "Ana", roleName: "DISEÑADOR", isActive: true },
    { id: "2", name: "Luis", roleName: "LIDER_DISEÑO", isActive: true },
    { id: "3", name: "Marta", roleName: "ADMINISTRADOR", isActive: true },
  ]);

  assert.deepEqual(
    filtered.map((row) => row.id),
    ["1", "2"],
  );
});

test("designer options: detecta roles legacy migrados", () => {
  assert.equal(
    isLegacyMigratedRole(
      "LEGACY_MIGRATED_ROLE_fc84ec3c-0f65-466a-8f94-e60b01bbc0d5",
    ),
    true,
  );
  assert.equal(isLegacyMigratedRole("DISEÑADOR"), false);
});

test("designer options: no hace fallback cuando solo hay roles legacy", () => {
  const filtered = filterDesignerOptions([
    {
      id: "1",
      name: "Ana",
      roleName: "LEGACY_MIGRATED_ROLE_a",
      isActive: true,
    },
    {
      id: "2",
      name: "Luis",
      roleName: "LEGACY_MIGRATED_ROLE_b",
      isActive: false,
    },
    {
      id: "3",
      name: "Marta",
      roleName: "LEGACY_MIGRATED_ROLE_c",
      isActive: true,
    },
  ]);

  assert.deepEqual(filtered, []);
});