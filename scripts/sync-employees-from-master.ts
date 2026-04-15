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

type EmployeeMaster = {
  identification: string;
  employeeCodeHint: string | null;
  name: string;
  cargo: string;
  roleName: string;
  email: string;
  mobile: string | null;
  address: string | null;
  contractType: ContractType;
};

const MASTER_XLSX_PATH =
  "C:/Users/USUARIO CAB/Downloads/PERMISOS, LICENCIAS, VACACIONES, RENUNCIAS, LLAMADO DE ATENCION.xlsx";
const CREDENTIALS_XLSX_PATH = "db/seeds/credenciales-usuarios.xlsx";

const ROLE_TO_PASSWORD_NAME: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  LIDER_DISEÑO: "LiderDiseño",
  DISEÑADOR: "Diseñador",
  ASESOR: "Asesor",
  LIDER_OPERACIONAL: "LiderOperacional",
  OPERARIO_DESPACHO: "OperarioDespacho",
  OPERARIO_BODEGA: "OperarioBodega",
  OPERARIO: "Operario",
  AUXILIAR_CONTABLE: "AuxiliarContable",
  COMPRA_INTERNACIONAL: "CompraInternacional",
  COMPRA_NACIONAL: "CompraNacional",
  RH: "RH",
};

const CARGO_TO_ROLE_RAW: Record<string, string> = {
  "DIRECTOR ADMINISTRATIVO": "ADMINISTRADOR",
  COORDINADOR: "ADMINISTRADOR",
  "LIDER DE CONTROL INTERNO": "ADMINISTRADOR",
  "DESARROLLADOR DE SOFWARE": "ADMINISTRADOR",
  "DESARROLLADOR DE SOFTWARE": "ADMINISTRADOR",
  "DIRECTOR GRAFICO": "LIDER_DISEÑO",
  DISEÑADOR: "DISEÑADOR",
  "DISEÑADOR GRAFICO": "DISEÑADOR",
  "DISEÑADOR COMERCIAL": "DISEÑADOR",
  "DISEÑADOR GRAFICO COMERCIAL": "DISEÑADOR",
  "DISEÑADORA DE MONTAJE": "DISEÑADOR",
  "APRENDIZ EN DESARROLLO DE MEDIOS GRAFICOS": "DISEÑADOR",
  "ASESOR COMERCIAL": "ASESOR",
  "ASISTENTE COMERCIAL": "ASESOR",
  "ASISTENTE EN VENTAS": "ASESOR",
  "EJECUTIVO DE VENTAS": "ASESOR",
  "SECRETARIA COMERCIAL": "ASESOR",
  "COMMUNITY MANAGER": "ASESOR",
  "LIDER DE PRODUCCIÓN": "LIDER_OPERACIONAL",
  "LOGISTICA Y PRODUCCIÓN": "LIDER_OPERACIONAL",
  "DIRECTOR DE CORTE Y TRAZO": "LIDER_OPERACIONAL",
  "LIDER DE DESPACHO": "OPERARIO_DESPACHO",
  "LIDER DE BODEGA": "OPERARIO_BODEGA",
  "AUXILIAR BODEGA": "OPERARIO_BODEGA",
  "AUXILIAR DE BODEGA": "OPERARIO_BODEGA",
  "AUXILIAR DE BODEGA DE DESPACHO": "OPERARIO_BODEGA",
  "AUXILIAR OPERATIVO": "OPERARIO",
  "AUXILIAR OPERATIVA": "OPERARIO",
  "AUXILIAR OPERATIVO ( SUBLIMACIÓN)": "OPERARIO",
  "AUXILIAR OPERATIVA DE SUBLIMACIÓN": "OPERARIO",
  "AUXILIAR DE PLOTTER": "OPERARIO",
  "AUXILIAR DE CORTE Y TRAZO": "OPERARIO",
  "AUXILIAR DE SERVICIOS GENERALES": "OPERARIO",
  CONDUCTOR: "OPERARIO",
  "AUXILIAR CONTABLE": "AUXILIAR_CONTABLE",
  "APRENDIZ EN TESORERIA Y FINANZAS": "AUXILIAR_CONTABLE",
  "COMERCIO EXTERIOR": "COMPRA_INTERNACIONAL",
  "ANALISTA DE COMERCIO EXTERIOR": "COMPRA_INTERNACIONAL",
  "TECNÓLOGO EN LOGISTICA": "COMPRA_NACIONAL",
  "AUXILIAR ADMINISTRATIVA": "RH",
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

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const CARGO_TO_ROLE: Record<string, string> = Object.fromEntries(
  Object.entries(CARGO_TO_ROLE_RAW).map(([cargo, role]) => [
    normalizeKey(cargo),
    role,
  ]),
);

function resolveRoleName(cargo: string) {
  const normalized = normalizeKey(cargo);

  if (normalized.includes("OPERARI")) {
    return "OPERARIO";
  }

  if (
    normalized.startsWith("AUXILIAR OPERATIV") ||
    normalized === "AUXILIAR DE PLOTTER" ||
    normalized === "AUXILIAR DE CORTE Y TRAZO" ||
    normalized === "AUXILIAR DE SERVICIOS GENERALES" ||
    normalized === "CONDUCTOR"
  ) {
    return "OPERARIO";
  }

  if (normalized.includes("DESARROLLADOR")) {
    return "ADMINISTRADOR";
  }

  const direct = CARGO_TO_ROLE[normalized];

  if (direct) return direct;

  throw new Error(`Cargo sin mapeo a role: ${cargo}`);
}

function mapContractType(raw: unknown): ContractType {
  const n = normalize(raw);

  if (n === "INDEFINIDO") return "INDEFINITE_TERM";
  if (n === "FIJO") return "FIXED_TERM";
  return "FIXED_TERM";
}

function buildUsername(name: string, identification: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const firstNameInitial = parts[0]?.charAt(0)?.toLowerCase() ?? "u";
  const secondToken = (parts[1] ?? parts[0] ?? "usuario").toLowerCase();
  const tail = identification.slice(-2).padStart(2, "0");

  return `${firstNameInitial}${secondToken}${tail}`.slice(0, 64);
}

function buildPassword(roleName: string) {
  const passwordPrefix = ROLE_TO_PASSWORD_NAME[roleName] ?? roleName;

  return `${passwordPrefix}2026`;
}

async function ensureRole(roleName: string) {
  const iamExisting = await iamDb
    .select({ id: iamRoles.id })
    .from(iamRoles)
    .where(eq(iamRoles.name, roleName))
    .limit(1);

  let roleId = iamExisting[0]?.id;

  if (!roleId) {
    const inserted = await iamDb
      .insert(iamRoles)
      .values({ name: roleName })
      .returning({ id: iamRoles.id });
    roleId = inserted[0]?.id;
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

async function getEmployeeCodeState() {
  const rows = await erpDb
    .select({ employeeCode: employees.employeeCode })
    .from(employees)
    .where(like(employees.employeeCode, "EMP%"));

  let max = 0;
  const used = new Set<string>();

  for (const row of rows) {
    const code = row.employeeCode ?? "";

    if (code) used.add(code);

    const parsed = Number.parseInt(code.replace(/^EMP/i, ""), 10);

    if (Number.isFinite(parsed)) {
      max = Math.max(max, parsed);
    }
  }

  return { nextNumber: max + 1, usedCodes: used };
}

function allocateEmployeeCode(
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

async function parseMasterActiveEmployees() {
  const workbook = xlsx.readFile(MASTER_XLSX_PATH);
  const sheet = workbook.Sheets.MAESTRO;

  if (!sheet) {
    throw new Error("No existe la hoja MAESTRO en el archivo fuente");
  }

  const rows = xlsx.utils.sheet_to_json<MasterRow>(sheet, { defval: null });

  const active = rows
    .filter((row) => normalize(row.ESTADO) === "ACTIVO")
    .map((row) => {
      const identification = normalizeDigits(
        row["ID 2"] ?? row["NUMERO DE DOCUMENTO"],
      );
      const name = String(row["NOMBRE COMPLETO"] ?? "").trim();
      const cargo = String(row.CARGO ?? "").trim();

      if (!identification || !name || !cargo) {
        return null;
      }

      const roleName = resolveRoleName(cargo);
      const usernameFallback = buildUsername(name, identification);
      const emailRaw = String(row.CORREO ?? "").trim().toLowerCase();
      const employeeCodeHint = row.ID
        ? `EMP${String(row.ID).padStart(4, "0")}`
        : null;

      return {
        identification,
        employeeCodeHint,
        name,
        cargo,
        roleName,
        email: emailRaw || `${usernameFallback}@empresa.com`,
        mobile: normalizeDigits(row.TELEFONO) || null,
        address:
          String(row["DIRECCIÓN DE RESIDENCIA"] ?? "").trim() || null,
        contractType: mapContractType(row["TIPO DE CONTRATO"]),
      } satisfies EmployeeMaster;
    })
    .filter((row): row is EmployeeMaster => row !== null);

  const byIdentification = new Map<string, EmployeeMaster>();

  for (const row of active) {
    byIdentification.set(row.identification, row);
  }

  return [...byIdentification.values()];
}

async function syncEmployees(employeesFromMaster: EmployeeMaster[]) {
  const roleNames = [...new Set(employeesFromMaster.map((row) => row.roleName))];
  const roleIdByName: Record<string, string> = {};

  for (const roleName of roleNames) {
    roleIdByName[roleName] = await ensureRole(roleName);
  }

  const codeState = await getEmployeeCodeState();

  const credentialsRows: Array<Record<string, string>> = [];

  let created = 0;
  let updated = 0;

  for (const person of employeesFromMaster) {
    const roleId = roleIdByName[person.roleName];
    const username = buildUsername(person.name, person.identification);
    const password = buildPassword(person.roleName);
    const passwordHash = await bcrypt.hash(password, 10);

    const existingEmployee = await erpDb
      .select({
        id: employees.id,
        userId: employees.userId,
        employeeCode: employees.employeeCode,
      })
      .from(employees)
      .where(eq(employees.identification, person.identification))
      .limit(1);

    let userId = existingEmployee[0]?.userId ?? null;

    if (!userId) {
      const existingUser = await iamDb
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.email, person.email), eq(users.username, username)))
        .limit(1);

      userId = existingUser[0]?.id ?? null;
    }

    if (!userId) {
      const inserted = await iamDb
        .insert(users)
        .values({
          username,
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
          username,
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

    let finalEmployeeCode = existingEmployee[0]?.employeeCode ?? "";

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

      updated += 1;
    } else {
      finalEmployeeCode = allocateEmployeeCode(person.employeeCodeHint, codeState);

      await erpDb.insert(employees).values({
        userId,
        employeeCode: finalEmployeeCode,
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

      created += 1;
    }

    credentialsRows.push({
      Código: finalEmployeeCode,
      Nombre: person.name,
      Username: username,
      Contraseña: password,
      Rol: person.roleName,
      Identificación: person.identification,
    });
  }

  return { created, updated, credentialsRows };
}

function updateCredentialsWorkbook(rowsToUpsert: Array<Record<string, string>>) {
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

  for (const row of rowsToUpsert) {
    byId.set(String(row["Identificación"] ?? "").trim(), row);
  }

  const merged = [...byId.values()].sort((a, b) =>
    String(a["Código"] ?? "").localeCompare(String(b["Código"] ?? ""), "es"),
  );

  const ws = xlsx.utils.json_to_sheet(merged, {
    header: [
      "Código",
      "Nombre",
      "Username",
      "Contraseña",
      "Rol",
      "Identificación",
    ],
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
  const activeEmployees = await parseMasterActiveEmployees();
  const result = await syncEmployees(activeEmployees);

  updateCredentialsWorkbook(result.credentialsRows);

  console.log(`Activos detectados en MAESTRO: ${activeEmployees.length}`);
  console.log(`Empleados creados: ${result.created}`);
  console.log(`Empleados actualizados: ${result.updated}`);
  console.log(`Credenciales sincronizadas: ${result.credentialsRows.length}`);
}

main().catch((error) => {
  console.error("Error sincronizando empleados desde MAESTRO:", error);
  process.exit(1);
});
