import "dotenv/config";

import bcrypt from "bcryptjs";
import { eq, like, or } from "drizzle-orm";
import xlsx from "xlsx";

import { db as erpDb, iamDb } from "@/src/db";
import {
  employees,
  roles as erpRoles,
  type ContractType,
} from "@/src/db/schema";
import { roles as iamRoles, users } from "@/src/db/iam/schema";

type MasterRow = Record<string, unknown>;

type DesignPerson = {
  identification: string;
  name: string;
  cargo: string;
  roleName: "DISEÑADOR" | "LIDER_DISEÑO";
  email: string;
  mobile: string | null;
  address: string | null;
  contractType: ContractType;
  employeeCodeHint: string | null;
};

const MASTER_XLSX_PATH =
  "C:/Users/USUARIO CAB/Downloads/PERMISOS, LICENCIAS, VACACIONES, RENUNCIAS, LLAMADO DE ATENCION.xlsx";
const CREDENTIALS_XLSX_PATH = "db/seeds/credenciales-usuarios.xlsx";

const ROLE_PASSWORD_NAME: Record<DesignPerson["roleName"], string> = {
  DISEÑADOR: "Diseñador",
  LIDER_DISEÑO: "LiderDiseño",
};

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function normalizeDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function toContractType(value: unknown): ContractType {
  const n = normalize(value);

  if (n === "INDEFINIDO") return "INDEFINITE_TERM";
  if (n === "FIJO") return "FIXED_TERM";
  return "FIXED_TERM";
}

function isDesignCargo(cargo: string) {
  const n = normalize(cargo);

  return (
    n === "DIRECTOR GRAFICO" ||
    n === "DISENADOR" ||
    n === "DISENADOR GRAFICO" ||
    n === "DISENADOR COMERCIAL" ||
    n === "DISENADOR GRAFICO COMERCIAL" ||
    n === "DISENADORA DE MONTAJE" ||
    n === "APRENDIZ EN DESARROLLO DE MEDIOS GRAFICOS"
  );
}

function roleFromCargo(cargo: string): DesignPerson["roleName"] {
  return normalize(cargo) === "DIRECTOR GRAFICO" ? "LIDER_DISEÑO" : "DISEÑADOR";
}

function buildUsername(name: string, identification: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0]?.toLowerCase() ?? "u";
  const second = (parts[1] ?? parts[0] ?? "usuario").toLowerCase();
  const tail = identification.slice(-2).padStart(2, "0");

  return `${first}${second}${tail}`.slice(0, 64);
}

function buildPassword(roleName: DesignPerson["roleName"]) {
  return `${ROLE_PASSWORD_NAME[roleName]}2026`;
}

async function ensureRole(roleName: string) {
  const iamExisting = await iamDb
    .select({ id: iamRoles.id })
    .from(iamRoles)
    .where(eq(iamRoles.name, roleName))
    .limit(1);

  let roleId = iamExisting[0]?.id;

  if (!roleId) {
    const created = await iamDb
      .insert(iamRoles)
      .values({ name: roleName })
      .returning({ id: iamRoles.id });
    roleId = created[0]?.id;
  }

  if (!roleId) {
    throw new Error(`No se pudo resolver roleId para ${roleName}`);
  }

  await erpDb
    .insert(erpRoles)
    .values({ id: roleId, name: roleName })
    .onConflictDoNothing();

  return roleId;
}

async function getEmployeeCodesState() {
  const rows = await erpDb
    .select({ employeeCode: employees.employeeCode })
    .from(employees)
    .where(like(employees.employeeCode, "EMP%"));

  let max = 0;
  const usedCodes = new Set<string>();

  for (const row of rows) {
    const raw = row.employeeCode ?? "";
    if (raw) usedCodes.add(raw);
    const num = Number.parseInt(raw.replace(/^EMP/, ""), 10);

    if (Number.isFinite(num)) {
      max = Math.max(max, num);
    }
  }

  return { nextNumber: max + 1, usedCodes };
}

function allocateUniqueEmployeeCode(
  hint: string | null,
  state: { nextNumber: number; usedCodes: Set<string> },
) {
  if (hint && !state.usedCodes.has(hint)) {
    state.usedCodes.add(hint);
    return hint;
  }

  while (true) {
    const candidate = `EMP${String(state.nextNumber).padStart(4, "0")}`;
    state.nextNumber += 1;

    if (!state.usedCodes.has(candidate)) {
      state.usedCodes.add(candidate);
      return candidate;
    }
  }
}

function parseMasterDesignPeople() {
  const workbook = xlsx.readFile(MASTER_XLSX_PATH);
  const sheet = workbook.Sheets.MAESTRO;

  if (!sheet) {
    throw new Error("No existe la hoja MAESTRO en el archivo fuente");
  }

  const rows = xlsx.utils.sheet_to_json<MasterRow>(sheet, { defval: null });

  const selected: DesignPerson[] = rows
    .filter((row) => normalize(row.ESTADO) === "ACTIVO")
    .filter((row) => isDesignCargo(String(row.CARGO ?? "")))
    .map((row) => {
      const identification = normalizeDigits(row["ID 2"] ?? row["NUMERO DE DOCUMENTO"]);
      const roleName = roleFromCargo(String(row.CARGO ?? ""));
      const emailRaw = String(row.CORREO ?? "").trim().toLowerCase();
      const fallbackEmail = `${buildUsername(String(row["NOMBRE COMPLETO"] ?? ""), identification)}@empresa.com`;

      return {
        identification,
        name: String(row["NOMBRE COMPLETO"] ?? "").trim(),
        cargo: String(row.CARGO ?? "").trim(),
        roleName,
        email: emailRaw || fallbackEmail,
        mobile: normalizeDigits(row.TELEFONO) || null,
        address: String(row["DIRECCIÓN DE RESIDENCIA"] ?? "").trim() || null,
        contractType: toContractType(row["TIPO DE CONTRATO"]),
        employeeCodeHint: row.ID ? `EMP${String(row.ID).padStart(4, "0")}` : null,
      };
    })
    .filter((row) => row.identification.length > 0 && row.name.length > 0);

  const byId = new Map<string, DesignPerson>();

  for (const row of selected) {
    byId.set(row.identification, row);
  }

  return [...byId.values()];
}

async function upsertDesignPeople(people: DesignPerson[]) {
  const roleIds = {
    DISEÑADOR: await ensureRole("DISEÑADOR"),
    LIDER_DISEÑO: await ensureRole("LIDER_DISEÑO"),
  };

  const credentialsRows: Array<Record<string, string>> = [];

  const codeState = await getEmployeeCodesState();

  for (const person of people) {
    const password = buildPassword(person.roleName);
    const passwordHash = await bcrypt.hash(password, 10);
    const preferredUsername = buildUsername(person.name, person.identification);

    const existingEmployee = await erpDb
      .select({ id: employees.id, userId: employees.userId, employeeCode: employees.employeeCode })
      .from(employees)
      .where(eq(employees.identification, person.identification))
      .limit(1);

    let userId = existingEmployee[0]?.userId ?? null;

    if (!userId) {
      const existingUser = await iamDb
        .select({ id: users.id })
        .from(users)
        .where(
          or(
            eq(users.email, person.email),
            eq(users.username, preferredUsername),
          ),
        )
        .limit(1);

      userId = existingUser[0]?.id ?? null;
    }

    if (!userId) {
      const inserted = await iamDb
        .insert(users)
        .values({
          username: preferredUsername,
          email: person.email,
          passwordHash,
          isActive: true,
          emailVerified: true,
        })
        .returning({ id: users.id });

      userId = inserted[0]?.id ?? null;
    } else {
      await iamDb
        .update(users)
        .set({
          username: preferredUsername,
          email: person.email,
          passwordHash,
          isActive: true,
          emailVerified: true,
        })
        .where(eq(users.id, userId));
    }

    if (!userId) {
      throw new Error(`No se pudo resolver userId para ${person.identification}`);
    }

    const roleId = roleIds[person.roleName];

    let insertedEmployeeCode: string | null = null;

    if (existingEmployee.length > 0) {
      await erpDb
        .update(employees)
        .set({
          userId,
          name: person.name,
          email: person.email,
          mobile: person.mobile ?? undefined,
          fullMobile: person.mobile ? `57${person.mobile}` : undefined,
          address: person.address ?? undefined,
          contractType: person.contractType,
          roleId,
          isActive: true,
          intlDialCode: "57",
        })
        .where(eq(employees.id, existingEmployee[0]!.id));
    } else {
      const employeeCode = allocateUniqueEmployeeCode(person.employeeCodeHint, codeState);
      insertedEmployeeCode = employeeCode;

      await erpDb.insert(employees).values({
        userId,
        employeeCode,
        name: person.name,
        identificationType: "CC",
        identification: person.identification,
        email: person.email,
        mobile: person.mobile ?? undefined,
        fullMobile: person.mobile ? `57${person.mobile}` : undefined,
        address: person.address ?? undefined,
        city: "Medellín",
        department: "ANTIOQUIA",
        contractType: person.contractType,
        roleId,
        isActive: true,
        intlDialCode: "57",
      });
    }

    const finalCode = existingEmployee[0]?.employeeCode ?? insertedEmployeeCode ?? person.employeeCodeHint ?? "";

    credentialsRows.push({
      Código: finalCode,
      Nombre: person.name,
      Username: preferredUsername,
      Contraseña: password,
      Rol: person.roleName,
      Identificación: person.identification,
    });
  }

  return credentialsRows;
}

function updateCredentialsWorkbook(designRows: Array<Record<string, string>>) {
  const workbook = xlsx.readFile(CREDENTIALS_XLSX_PATH);
  const sheetName = workbook.SheetNames[0] ?? "Credenciales";
  const currentRows = xlsx.utils.sheet_to_json<Record<string, string>>(
    workbook.Sheets[sheetName],
    { defval: "" },
  );

  const byId = new Map<string, Record<string, string>>();

  for (const row of currentRows) {
    byId.set(String(row["Identificación"] ?? "").trim(), row);
  }

  for (const row of designRows) {
    byId.set(String(row["Identificación"] ?? "").trim(), row);
  }

  const merged = [...byId.values()];

  merged.sort((a, b) => String(a["Código"] ?? "").localeCompare(String(b["Código"] ?? ""), "es"));

  const ws = xlsx.utils.json_to_sheet(merged, {
    header: ["Código", "Nombre", "Username", "Contraseña", "Rol", "Identificación"],
  });

  ws["!cols"] = [
    { wch: 12 },
    { wch: 40 },
    { wch: 18 },
    { wch: 22 },
    { wch: 24 },
    { wch: 16 },
  ];

  workbook.Sheets[sheetName] = ws;
  xlsx.writeFile(workbook, CREDENTIALS_XLSX_PATH);
}

async function main() {
  const people = parseMasterDesignPeople();

  console.log(`Diseño activo detectado en MAESTRO: ${people.length}`);

  const credentialsRows = await upsertDesignPeople(people);

  updateCredentialsWorkbook(credentialsRows);

  console.log("Sincronización completada.");
  console.log(`Registros de diseño sincronizados: ${credentialsRows.length}`);
}

main().catch((error) => {
  console.error("Error en sincronización de diseño:", error);
  process.exit(1);
});
