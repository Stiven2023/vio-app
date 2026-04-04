export type EmployeeRoleReference = {
  employeeCode: string;
  identification: string;
  name: string;
  cargo?: string;
  canonicalRoleName: string;
};

export type LegacyEmployeeRoleRow = {
  id?: string;
  employeeCode?: string | null;
  identification?: string | null;
  name?: string | null;
  roleId?: string | null;
  roleName?: string | null;
  isActive?: boolean | null;
};

export type CanonicalRoleMatch = {
  canonicalRoleName: string;
  matchSource: "identification" | "employeeCode" | "name";
  reference: EmployeeRoleReference;
};

type EmployeeRoleReferenceIndex = {
  byIdentification: Map<string, EmployeeRoleReference>;
  byEmployeeCode: Map<string, EmployeeRoleReference>;
  byName: Map<string, EmployeeRoleReference[]>;
};

export function normalizeEmployeeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function buildEmployeeRoleReferences<T extends {
  employeeCode: string;
  identification: string;
  name: string;
  cargo: string;
}>(
  rows: T[],
  resolveRoleName: (cargo: string) => string,
): EmployeeRoleReference[] {
  const byIdentification = new Map<string, EmployeeRoleReference>();

  for (const row of rows) {
    byIdentification.set(String(row.identification), {
      employeeCode: String(row.employeeCode),
      identification: String(row.identification),
      name: String(row.name),
      cargo: String(row.cargo),
      canonicalRoleName: resolveRoleName(String(row.cargo)),
    });
  }

  return [...byIdentification.values()];
}

export function buildEmployeeRoleReferenceIndex(
  references: EmployeeRoleReference[],
): EmployeeRoleReferenceIndex {
  const byIdentification = new Map<string, EmployeeRoleReference>();
  const byEmployeeCode = new Map<string, EmployeeRoleReference>();
  const byName = new Map<string, EmployeeRoleReference[]>();

  for (const reference of references) {
    const identification = normalizeEmployeeText(reference.identification);
    const employeeCode = normalizeEmployeeText(reference.employeeCode);
    const name = normalizeEmployeeText(reference.name);

    if (identification) {
      byIdentification.set(identification, reference);
    }

    if (employeeCode) {
      byEmployeeCode.set(employeeCode, reference);
    }

    if (!name) {
      continue;
    }

    byName.set(name, [...(byName.get(name) ?? []), reference]);
  }

  return { byIdentification, byEmployeeCode, byName };
}

export function resolveCanonicalRoleForEmployee(
  row: LegacyEmployeeRoleRow,
  index: EmployeeRoleReferenceIndex,
): CanonicalRoleMatch | null {
  const identification = normalizeEmployeeText(row.identification);

  if (identification) {
    const byIdentification = index.byIdentification.get(identification);

    if (byIdentification) {
      return {
        canonicalRoleName: byIdentification.canonicalRoleName,
        matchSource: "identification",
        reference: byIdentification,
      };
    }
  }

  const employeeCode = normalizeEmployeeText(row.employeeCode);

  if (employeeCode) {
    const byEmployeeCode = index.byEmployeeCode.get(employeeCode);

    if (byEmployeeCode) {
      return {
        canonicalRoleName: byEmployeeCode.canonicalRoleName,
        matchSource: "employeeCode",
        reference: byEmployeeCode,
      };
    }
  }

  const name = normalizeEmployeeText(row.name);

  if (!name) {
    return null;
  }

  const byName = index.byName.get(name) ?? [];

  if (byName.length !== 1) {
    return null;
  }

  return {
    canonicalRoleName: byName[0].canonicalRoleName,
    matchSource: "name",
    reference: byName[0],
  };
}