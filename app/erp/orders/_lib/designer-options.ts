import { isLegacyMigratedRole } from "@/src/utils/legacy-roles";

export { isLegacyMigratedRole };

export type DesignerOption = {
  id: string;
  name: string;
  role?: string | null;
  roleName?: string | null;
  isActive?: boolean | null;
};

function normalizeRoleKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function isDesignerAssignableRole(value: unknown) {
  const normalizedRole = normalizeRoleKey(value);

  return (
    normalizedRole === "DISENADOR" ||
    normalizedRole === "LIDER_DISENO"
  );
}

export function filterDesignerOptions<T extends DesignerOption>(
  rows: T[],
): T[] {
  return rows.filter((row) =>
    isDesignerAssignableRole(row.roleName ?? row.role),
  );
}