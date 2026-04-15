import "dotenv/config";

import fs from "node:fs";

import bcrypt from "bcryptjs";
import { desc, eq, like } from "drizzle-orm";
import xlsx from "xlsx";

import { erpDb, iamDb } from "@/src/db";
import { roles as iamRoles, users as iamUsers } from "@/src/db/iam/schema";
import {
  confectionists,
  employees,
  messengers,
  packers,
  roles as erpRoles,
} from "@/src/db/schema";

type IdType = "CC" | "NIT" | "CE" | "PAS" | "EMPRESA_EXTERIOR";
type TaxRegime = "REGIMEN_COMUN" | "REGIMEN_SIMPLIFICADO" | "NO_RESPONSABLE";
type ThirdRole = "CONFECCIONISTA" | "EMPAQUE" | "MENSAJERO" | "CONDUCTOR";

type ConfectionistExcelRow = {
  name: string;
  address: string;
  neighborhood: string | null;
  phone: string | null;
  email: string | null;
  identificationType: IdType;
  identification: string;
  dv: string | null;
  bankAccount: string | null;
};

const DEFAULT_XLSX_PATH =
  "D:/Programación/Vio/INFORMACION DE CONFECCIONISTAS.xlsx";

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function pickValue(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (alias in row) return row[alias];
  }

  return "";
}

function asNullable(value: unknown) {
  const text = normalizeText(value);

  if (!text) return null;

  const upper = text.toUpperCase();

  if (upper === "NO TIENE CORREO" || upper === "N/A" || upper === "NA") {
    return null;
  }

  return text;
}

function normalizeEmail(value: unknown) {
  const text = asNullable(value);

  if (!text) return null;

  return text.toLowerCase();
}

function normalizeAccountNumber(value: unknown) {
  const raw = asNullable(value);

  if (!raw) return null;

  const digits = raw.replace(/\D+/g, "").slice(0, 20);

  if (digits) return digits;

  return raw.slice(0, 20);
}

function parseIdentification(rawValue: unknown): {
  identificationType: IdType;
  identification: string;
  dv: string | null;
} {
  const raw = normalizeText(rawValue).toUpperCase();

  if (!raw) {
    throw new Error("Fila sin cedula/NIT");
  }

  const compact = raw.replace(/\s+/g, "");

  if (compact.startsWith("CC")) {
    const identification = compact.replace(/^CC/, "").replace(/\D+/g, "");

    if (!identification) throw new Error(`Documento CC invalido: ${raw}`);

    return { identificationType: "CC", identification, dv: null };
  }

  if (compact.startsWith("CE")) {
    const identification = compact
      .replace(/^CE/, "")
      .replace(/[^A-Z0-9]+/g, "");

    if (!identification) throw new Error(`Documento CE invalido: ${raw}`);

    return { identificationType: "CE", identification, dv: null };
  }

  if (compact.startsWith("PAS")) {
    const identification = compact
      .replace(/^PAS/, "")
      .replace(/[^A-Z0-9]+/g, "");

    if (!identification) throw new Error(`Documento PAS invalido: ${raw}`);

    return { identificationType: "PAS", identification, dv: null };
  }

  if (compact.startsWith("NIT")) {
    const rest = compact.replace(/^NIT/, "");
    const [base, dvRaw] = rest.split("-");
    const identification = String(base ?? "").replace(/\D+/g, "");
    const dv = String(dvRaw ?? "")
      .replace(/\D+/g, "")
      .slice(0, 1);

    if (!identification) throw new Error(`Documento NIT invalido: ${raw}`);

    return {
      identificationType: "NIT",
      identification,
      dv: dv || null,
    };
  }

  const digits = compact.replace(/\D+/g, "");

  if (!digits) {
    throw new Error(`Documento invalido: ${raw}`);
  }

  return { identificationType: "CC", identification: digits, dv: null };
}

function taxRegimeFromIdType(type: IdType): TaxRegime {
  if (type === "NIT") return "REGIMEN_COMUN";

  return "NO_RESPONSABLE";
}

function loadConfectionistsFromExcel(
  filePath: string,
): ConfectionistExcelRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe el Excel en la ruta: ${filePath}`);
  }

  const workbook = xlsx.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  const parsedRows: ConfectionistExcelRow[] = [];

  for (const row of rows) {
    const normalizedRow = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]),
    );

    const name = normalizeText(normalizedRow["NOMBRE O TALLER"]);

    if (!name) continue;

    let parsedDocument: {
      identificationType: IdType;
      identification: string;
      dv: string | null;
    };

    try {
      parsedDocument = parseIdentification(
        pickValue(normalizedRow, [
          "CEDULA O NIT",
          "CE DULA O NIT",
          "DOCUMENTO",
        ]),
      );
    } catch {
      parsedDocument = {
        identificationType: "CC",
        identification: "",
        dv: null,
      };
      console.warn(
        `Documento invalido en Excel, se inventara identificacion para: ${name}`,
      );
    }
    const address =
      normalizeText(normalizedRow["DIRECCION"]) || "SIN DIRECCION";

    parsedRows.push({
      name,
      address,
      neighborhood: asNullable(normalizedRow["BARRIO"]),
      phone: asNullable(normalizedRow["TELEFONO"]),
      email: normalizeEmail(normalizedRow["CORREO"]),
      identificationType: parsedDocument.identificationType,
      identification: parsedDocument.identification,
      dv: parsedDocument.dv,
      bankAccount: asNullable(normalizedRow["CUENTA BANCARIA"]),
    });
  }

  return parsedRows;
}

function nextPassword(seed: string) {
  const tail = String(seed ?? "")
    .replace(/\D+/g, "")
    .slice(-4)
    .padStart(4, "0");

  return `Vio*${tail}A`;
}

function sanitizeUsernameBase(value: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9]+$/, "");

  if (base.length >= 3) return base.slice(0, 32);

  return "userseed";
}

function usernameFromFirstNameAndSurname(fullName: string) {
  const parts = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const firstName = parts[0] ?? "u";
  const firstSurname = parts[1] ?? parts[0] ?? "user";

  const base = `${firstName.charAt(0)}${firstSurname}`.toLowerCase();

  return sanitizeUsernameBase(base);
}

async function ensureRole(roleName: string) {
  const [iamRole] = await iamDb
    .select({ id: iamRoles.id })
    .from(iamRoles)
    .where(eq(iamRoles.name, roleName))
    .limit(1);

  let roleId = iamRole?.id;

  if (!roleId) {
    const [insertedRole] = await iamDb
      .insert(iamRoles)
      .values({ name: roleName })
      .returning({ id: iamRoles.id });

    roleId = insertedRole.id;
  }

  await erpDb
    .insert(erpRoles)
    .values({ id: roleId, name: roleName })
    .onConflictDoNothing();

  return roleId;
}

async function buildNextEmployeeCode() {
  const [lastEmployee] = await erpDb
    .select({ employeeCode: employees.employeeCode })
    .from(employees)
    .where(like(employees.employeeCode, "EMP%"))
    .orderBy(desc(employees.employeeCode))
    .limit(1);

  const parsed = Number(
    String(lastEmployee?.employeeCode ?? "").replace(/^EMP/i, ""),
  );
  let nextNumber = 1001;

  if (Number.isFinite(parsed) && parsed > 0) {
    nextNumber = parsed + 1;
  }

  return () => {
    const code = `EMP${nextNumber}`;

    nextNumber += 1;

    return code;
  };
}

async function buildUniqueEmployeeIdentification(base: number) {
  let candidate = base;

  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const [exists] = await erpDb
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.identification, String(candidate)))
      .limit(1);

    if (!exists) return String(candidate);
    candidate += 1;
  }

  throw new Error("No se pudo generar identificacion unica para employees");
}

async function ensureUserAndEmployeeAccount(params: {
  roleName: ThirdRole;
  roleId: string;
  usernameBase: string;
  password: string;
  displayName: string;
  employeeIdentificationBase: number;
  nextEmployeeCode: () => string;
}) {
  const username = sanitizeUsernameBase(params.usernameBase);
  const email = `${username}@terceros.viomar.local`;
  const passwordHash = await bcrypt.hash(params.password, 10);

  const [existingByUsername] = await iamDb
    .select({ id: iamUsers.id })
    .from(iamUsers)
    .where(eq(iamUsers.username, username))
    .limit(1);

  const [existingByEmail] = existingByUsername
    ? [{ id: existingByUsername.id }]
    : await iamDb
        .select({ id: iamUsers.id })
        .from(iamUsers)
        .where(eq(iamUsers.email, email))
        .limit(1);

  let userId = existingByEmail?.id;

  if (!userId) {
    const [insertedUser] = await iamDb
      .insert(iamUsers)
      .values({
        username,
        email,
        passwordHash,
        emailVerified: true,
        isActive: true,
      })
      .returning({ id: iamUsers.id });

    userId = insertedUser.id;
  } else {
    await iamDb
      .update(iamUsers)
      .set({
        username,
        email,
        passwordHash,
        emailVerified: true,
        isActive: true,
      })
      .where(eq(iamUsers.id, userId));
  }

  const [employeeByUserId] = await erpDb
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.userId, userId))
    .limit(1);

  const employeePatch = {
    userId,
    name: params.displayName,
    identificationType: "CC" as const,
    email,
    roleId: params.roleId,
    isActive: true,
    city: "Medellin",
    department: "ANTIOQUIA",
    intlDialCode: "57",
  };

  if (employeeByUserId) {
    await erpDb
      .update(employees)
      .set(employeePatch)
      .where(eq(employees.id, employeeByUserId.id));

    return {
      username,
      email,
      password: params.password,
      role: params.roleName,
    };
  }

  const employeeIdentification = await buildUniqueEmployeeIdentification(
    params.employeeIdentificationBase,
  );

  await erpDb.insert(employees).values({
    ...employeePatch,
    employeeCode: params.nextEmployeeCode(),
    identification: employeeIdentification,
  });

  return { username, email, password: params.password, role: params.roleName };
}

async function getNextCode(
  prefix: string,
  source: "confectionists" | "packers",
) {
  if (source === "confectionists") {
    const [last] = await erpDb
      .select({ code: confectionists.confectionistCode })
      .from(confectionists)
      .where(like(confectionists.confectionistCode, `${prefix}%`))
      .orderBy(desc(confectionists.confectionistCode))
      .limit(1);

    const n = Number.parseInt(
      String(last?.code ?? "").replace(/^\D+/g, ""),
      10,
    );

    return Number.isFinite(n) ? n + 1 : 1001;
  }

  const [last] = await erpDb
    .select({ code: packers.packerCode })
    .from(packers)
    .where(like(packers.packerCode, `${prefix}%`))
    .orderBy(desc(packers.packerCode))
    .limit(1);

  const n = Number.parseInt(String(last?.code ?? "").replace(/^\D+/g, ""), 10);

  return Number.isFinite(n) ? n + 1 : 1001;
}

async function seedConfectionistsFromExcel(filePath: string) {
  const rows = loadConfectionistsFromExcel(filePath);
  let nextCodeNumber = await getNextCode("CON", "confectionists");

  const seeded: Array<{
    name: string;
    identification: string;
    usernameBase: string;
    password: string;
  }> = [];

  let created = 0;
  let updated = 0;
  let inventedIdCounter = 97000000;

  for (const row of rows) {
    let identification = row.identification;
    let identificationType = row.identificationType;
    let dv = row.dv;

    if (!identification) {
      identification = String(inventedIdCounter);
      identificationType = "CC";
      dv = null;
      inventedIdCounter += 1;
      console.warn(
        `Inventando identificacion para confeccionista ${row.name}: ${identification}`,
      );
    }

    const [existing] = await erpDb
      .select({ id: confectionists.id, code: confectionists.confectionistCode })
      .from(confectionists)
      .where(eq(confectionists.identification, identification))
      .limit(1);

    const patch = {
      name: row.name,
      identificationType,
      identification,
      dv,
      taxRegime: taxRegimeFromIdType(identificationType),
      type: "TALLER EXTERNO",
      specialty: row.neighborhood ?? "CONFECCION",
      contactName: row.name,
      email: row.email,
      mobile: row.phone,
      fullMobile: row.phone ? `57${row.phone}` : null,
      address: row.address,
      city: "Medellin",
      department: "ANTIOQUIA",
      intlDialCode: "57",
      accountNumber: normalizeAccountNumber(row.bankAccount),
      isActive: true,
    };

    if (existing) {
      await erpDb
        .update(confectionists)
        .set(patch)
        .where(eq(confectionists.id, existing.id));
      updated += 1;
    } else {
      const code = `CON${nextCodeNumber}`;

      nextCodeNumber += 1;

      await erpDb.insert(confectionists).values({
        confectionistCode: code,
        ...patch,
      });
      created += 1;
    }

    seeded.push({
      name: row.name,
      identification,
      usernameBase: `conf.${identification}`,
      password: nextPassword(identification),
    });
  }

  return {
    totalExcelRows: rows.length,
    created,
    updated,
    seeded,
  };
}

async function seedDefaultPacker() {
  const defaultPacker = {
    name: "VIOMAR",
    identificationType: "NIT" as const,
    identification: "900999001",
    dv: "1",
    packerType: "INTERNO",
    specialty: "EMPAQUE GENERAL",
    contactName: "VIOMAR",
    email: "empaque@viomar.local",
    mobile: "3000000001",
    fullMobile: "573000000001",
    address: "SEDE VIOMAR",
    city: "Medellin",
    department: "ANTIOQUIA",
    intlDialCode: "57",
    isActive: true,
  };

  const [existing] = await erpDb
    .select({ id: packers.id })
    .from(packers)
    .where(eq(packers.identification, defaultPacker.identification))
    .limit(1);

  let created = 0;
  let updated = 0;

  if (existing) {
    await erpDb
      .update(packers)
      .set(defaultPacker)
      .where(eq(packers.id, existing.id));
    updated = 1;
  } else {
    const nextCodeNumber = await getNextCode("EMPA", "packers");

    await erpDb.insert(packers).values({
      packerCode: `EMPA${nextCodeNumber}`,
      ...defaultPacker,
    });
    created = 1;
  }

  return {
    created,
    updated,
    usernameBase: "empaque.viomar",
    password: "Vio*9001A",
    name: "VIOMAR EMPAQUE",
  };
}

async function seedMessengersAndDrivers() {
  const defaults: Array<{
    name: string;
    role: "MENSAJERO" | "CONDUCTOR";
    identification: string;
    vehicleType: string;
    vehiclePlate: string | null;
  }> = [
    {
      name: "MARIO LOPEZ",
      role: "MENSAJERO",
      identification: "88000001",
      vehicleType: "MOTO",
      vehiclePlate: null,
    },
    {
      name: "JUAN PEREZ",
      role: "MENSAJERO",
      identification: "88000002",
      vehicleType: "MOTO",
      vehiclePlate: null,
    },
    {
      name: "CARLOS RAMIREZ",
      role: "CONDUCTOR",
      identification: "89000001",
      vehicleType: "CAMIONETA",
      vehiclePlate: "VIO101",
    },
    {
      name: "DIEGO GUTIERREZ",
      role: "CONDUCTOR",
      identification: "89000002",
      vehicleType: "CAMIONETA",
      vehiclePlate: "VIO102",
    },
  ];

  const seeded: Array<{
    name: string;
    role: "MENSAJERO" | "CONDUCTOR";
    identification: string;
    usernameBase: string;
    password: string;
  }> = [];

  let created = 0;
  let updated = 0;
  let mensCode = await (async () => {
    const [last] = await erpDb
      .select({ code: messengers.messengerCode })
      .from(messengers)
      .where(like(messengers.messengerCode, "MENS%"))
      .orderBy(desc(messengers.messengerCode))
      .limit(1);
    const n = Number.parseInt(
      String(last?.code ?? "").replace(/^\D+/g, ""),
      10,
    );

    return Number.isFinite(n) ? n + 1 : 1001;
  })();

  let condCode = await (async () => {
    const [last] = await erpDb
      .select({ code: messengers.messengerCode })
      .from(messengers)
      .where(like(messengers.messengerCode, "COND%"))
      .orderBy(desc(messengers.messengerCode))
      .limit(1);
    const n = Number.parseInt(
      String(last?.code ?? "").replace(/^\D+/g, ""),
      10,
    );

    return Number.isFinite(n) ? n + 1 : 1001;
  })();

  for (const row of defaults) {
    const [existing] = await erpDb
      .select({ id: messengers.id })
      .from(messengers)
      .where(eq(messengers.identification, row.identification))
      .limit(1);

    const patch = {
      name: row.name,
      identificationType: "CC" as const,
      identification: row.identification,
      messengerType: row.role,
      vehicleType: row.vehicleType,
      vehiclePlate: row.vehiclePlate,
      address: "SEDE VIOMAR",
      city: "Medellin",
      department: "ANTIOQUIA",
      country: "COLOMBIA",
      intlDialCode: "57",
      mobile: null,
      email: null,
      isActive: true,
    };

    if (existing) {
      await erpDb
        .update(messengers)
        .set(patch)
        .where(eq(messengers.id, existing.id));
      updated += 1;
    } else {
      const code =
        row.role === "CONDUCTOR" ? `COND${condCode}` : `MENS${mensCode}`;

      if (row.role === "CONDUCTOR") condCode += 1;
      if (row.role === "MENSAJERO") mensCode += 1;

      await erpDb.insert(messengers).values({ messengerCode: code, ...patch });
      created += 1;
    }

    seeded.push({
      name: row.name,
      role: row.role,
      identification: row.identification,
      usernameBase: usernameFromFirstNameAndSurname(row.name),
      password: nextPassword(row.identification),
    });
  }

  return { created, updated, total: defaults.length, seeded };
}

function getExcelArgPath() {
  const argv = process.argv.slice(2);
  const idx = argv.findIndex((arg) => arg === "--xlsx");

  if (idx >= 0 && argv[idx + 1]) {
    return argv[idx + 1];
  }

  return process.env.CONFECTIONISTS_XLSX_PATH ?? DEFAULT_XLSX_PATH;
}

export async function seedThirdPartiesBootstrap() {
  const excelPath = getExcelArgPath();

  const roleConfectionistId = await ensureRole("CONFECCIONISTA");
  const rolePackerId = await ensureRole("EMPAQUE");
  const roleMessengerId = await ensureRole("MENSAJERO");
  const roleDriverId = await ensureRole("CONDUCTOR");

  const nextEmployeeCode = await buildNextEmployeeCode();
  const confectionistsResult = await seedConfectionistsFromExcel(excelPath);
  const packerResult = await seedDefaultPacker();
  const messengerResult = await seedMessengersAndDrivers();

  const credentials: Array<{
    username: string;
    email: string;
    password: string;
    role: ThirdRole;
  }> = [];

  let confIndex = 1;

  for (const row of confectionistsResult.seeded) {
    const account = await ensureUserAndEmployeeAccount({
      roleName: "CONFECCIONISTA",
      roleId: roleConfectionistId,
      usernameBase: row.usernameBase,
      password: row.password,
      displayName: row.name,
      employeeIdentificationBase: 78000000 + confIndex,
      nextEmployeeCode,
    });

    credentials.push(account);
    confIndex += 1;
  }

  const packerAccount = await ensureUserAndEmployeeAccount({
    roleName: "EMPAQUE",
    roleId: rolePackerId,
    usernameBase: packerResult.usernameBase,
    password: packerResult.password,
    displayName: packerResult.name,
    employeeIdentificationBase: 79000001,
    nextEmployeeCode,
  });

  credentials.push(packerAccount);

  let messengerIndex = 1;
  let driverIndex = 1;

  for (const row of messengerResult.seeded) {
    const roleName = row.role;
    const account = await ensureUserAndEmployeeAccount({
      roleName,
      roleId: roleName === "MENSAJERO" ? roleMessengerId : roleDriverId,
      usernameBase: row.usernameBase,
      password: row.password,
      displayName: row.name,
      employeeIdentificationBase:
        roleName === "MENSAJERO"
          ? 79500000 + messengerIndex
          : 79600000 + driverIndex,
      nextEmployeeCode,
    });

    credentials.push(account);

    if (roleName === "MENSAJERO") messengerIndex += 1;
    if (roleName === "CONDUCTOR") driverIndex += 1;
  }

  console.log("== Seed terceros bootstrap ==");
  console.log(`Excel confecionistas: ${excelPath}`);
  console.log(
    `Confecionistas Excel leidos: ${confectionistsResult.totalExcelRows}`,
  );
  console.log(`Confecionistas creados: ${confectionistsResult.created}`);
  console.log(`Confecionistas actualizados: ${confectionistsResult.updated}`);
  console.log(`Empaque creados: ${packerResult.created}`);
  console.log(`Empaque actualizados: ${packerResult.updated}`);
  console.log(`Mensajeros/Conductores creados: ${messengerResult.created}`);
  console.log(
    `Mensajeros/Conductores actualizados: ${messengerResult.updated}`,
  );
  console.log("");
  console.log("== Credenciales (username | password | role) ==");
  for (const row of credentials) {
    console.log(`${row.username} | ${row.password} | ${row.role}`);
  }

  return {
    confectionistsResult,
    packerResult,
    messengerResult,
    credentials,
  };
}

if (require.main === module) {
  seedThirdPartiesBootstrap().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
