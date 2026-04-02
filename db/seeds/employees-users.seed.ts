import "dotenv/config";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { erpDb, iamDb } from "@/src/db";
import { employees } from "@/src/db/erp/schema";
import { roles, users } from "@/src/db/iam/schema";

type RawContractType = "INDEFINIDO" | "FIJO" | "APRENDIZAJE";

type EmployeeContractType =
  | "FIXED_TERM"
  | "INDEFINITE_TERM"
  | "WORK_CONTRACT"
  | "SERVICE_CONTRACT";

type ActiveEmployee = {
  employeeCode: string;
  name: string;
  identification: string;
  email: string;
  mobile: string | null;
  address: string | null;
  cargo: string;
  contractType: RawContractType;
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

const CARGO_TO_ROLE: Record<string, string> = Object.fromEntries(
  Object.entries(CARGO_TO_ROLE_RAW).map(([cargo, role]) => [
    normalizeKey(cargo),
    role,
  ]),
);

const activeEmployees: ActiveEmployee[] = [
  {
    employeeCode: "EMP0001",
    name: "ANDRES FELIPE ALVAREZ CORDOBA",
    identification: "1035416950",
    email: "andresalvarez@empresa.com",
    mobile: "3004687650",
    address: "CLL 52 N 55 - 39",
    cargo: "DIRECTOR GRAFICO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0002",
    name: "ANDRES FELIPE CASTAÑO POSADA",
    identification: "1037605206",
    email: "andresfelipe_1990@hotmail.es",
    mobile: "3176935759",
    address: "TRANSVERSAL 27 A SUR 42 -90",
    cargo: "ASISTENTE COMERCIAL",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0003",
    name: "ANGELO ESTEBAN ZAPATA SALAZAR",
    identification: "1152436767",
    email: "angelozapata34@gmail.com",
    mobile: null,
    address: "CL 83A 36C 21",
    cargo: "COORDINADOR",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0004",
    name: "BIBIANA YAMILE ZULUAGA HENAO",
    identification: "43455439",
    email: "bibianahenao@empresa.com",
    mobile: "3128968020",
    address: null,
    cargo: "OPERARIA",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0005",
    name: "ELIANA MARIETH OCAMPO PINEDA",
    identification: "43840427",
    email: "emarieth@hotmail.com",
    mobile: "3146379457",
    address: "CLL 27 N 68 22",
    cargo: "AUXILIAR CONTABLE",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0006",
    name: "DIANA MARIA CASTRO AGUIRRE",
    identification: "1037570183",
    email: "mariangelvale27@gmail.com",
    mobile: "3022436954",
    address: "CR 42 N 54A 151",
    cargo: "OPERARIA",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0007",
    name: "DINA LUZ MARTINEZ CARDOZO",
    identification: "1100549200",
    email: "dinamartinez@empresa.com",
    mobile: "3147722510",
    address: "CR 41 N 54 A 151",
    cargo: "OPERARIA",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0008",
    name: "EDDISON ALIRIO SALAZAR CASTAÑO",
    identification: "98666753",
    email: "eddisonsalazar@empresa.com",
    mobile: "3005056907",
    address: null,
    cargo: "LOGISTICA Y PRODUCCIÓN",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0009",
    name: "ELIZABETH CUARTAS TAMAYO",
    identification: "43169005",
    email: "eli9005@hotmail.com",
    mobile: "3103826404",
    address: "CR 51A 31AE 8",
    cargo: "ASESOR COMERCIAL",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0010",
    name: "ERIKA YAMILE VALENCIA",
    identification: "32107971",
    email: "erikayamilevalencia20@gmail.com",
    mobile: "3222421753",
    address: "CL 76 N 41A 31",
    cargo: "OPERARIO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0011",
    name: "GIOVANNY ALBERTO OTALVARO CHICA",
    identification: "71381483",
    email: "yoba63@hotmail.com",
    mobile: "3012852535",
    address: "CR 66 N 63 - 53",
    cargo: "COMERCIO EXTERIOR",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0012",
    name: "JONIER ALEXANDER GOMEZ MARTINEZ",
    identification: "1006961268",
    email: "joniergomez@empresa.com",
    mobile: "3205234340",
    address: "CL 70 # 51 - 05",
    cargo: "DISEÑADOR GRAFICO COMERCIAL",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0013",
    name: "JUAN DAVID VELEZ ALZATE",
    identification: "1001505828",
    email: "juandavidvelez@empresa.com",
    mobile: "3223302",
    address: "CLL 41AA SUR N 29B 54",
    cargo: "OPERARIO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0014",
    name: "LUIS ALFONSO LONDOÑO CASTAÑO",
    identification: "1037580276",
    email: "luisalfonso@empresa.com",
    mobile: "3003283971",
    address: "CLL 27 N 81 56",
    cargo: "DIRECTOR ADMINISTRATIVO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0015",
    name: "LUIS OSCAR GARCIA URAN",
    identification: "71728478",
    email: "futbol290372@hotmail.com",
    mobile: "3206106367",
    address: "CR 38 N 79D 40",
    cargo: "DIRECTOR DE CORTE Y TRAZO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0016",
    name: "LUISA RESTREPO OSORIO",
    identification: "1036679905",
    email: "luisarestrepo@empresa.com",
    mobile: "3054306290",
    address: "CLL 51 N 57 - 42",
    cargo: "ANALISTA DE COMERCIO EXTERIOR",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0017",
    name: "MALLERLY JIMENEZ GARCES",
    identification: "1001452597",
    email: "mallerlygarces19@gmail.com",
    mobile: "3017827396",
    address: "CLL 98 N 50AA 04",
    cargo: "AUXILIAR ADMINISTRATIVA",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0018",
    name: "MARITZA DE JESUS JIMENEZ JIMENEZ",
    identification: "43346439",
    email: "maritzajim2009@hotmail.com",
    mobile: "3103990659",
    address: "CLL 80 N 55C 41",
    cargo: "OPERARIA",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0019",
    name: "NAREN FERNEY CASTRO QUINTANA",
    identification: "1092357141",
    email: "naren.fq@gmail.com",
    mobile: "3204014472",
    address: "CLL 110 N 46A 40",
    cargo: "DISEÑADOR GRAFICO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0020",
    name: "SANDRA MILENA LONDOÑO CASTAÑO",
    identification: "32241321",
    email: "sandralondono@empresa.com",
    mobile: "3226612523",
    address: "CLL 71 N 58 - 102",
    cargo: "AUXILIAR BODEGA",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0021",
    name: "SEIDY YOHANA MARTINEZ VERGARA",
    identification: "1100401794",
    email: "seidymartinez0880@gmail.com",
    mobile: "3024200174",
    address: "CLL 92 CR 43B 43",
    cargo: "OPERARIO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0022",
    name: "SOL MARIA CARDONA VALENCIA",
    identification: "32109843",
    email: "solmariacardona@empresa.com",
    mobile: "3007189587",
    address: "CR 28 N 90A 96",
    cargo: "OPERARIA",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0023",
    name: "YIGET MOSCOSO ARIAS",
    identification: "1040571829",
    email: "yigetmoscoso@empresa.com",
    mobile: "3006130124",
    address: null,
    cargo: "AUXILIAR OPERATIVO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0024",
    name: "BRAYAN ALEJANDRO GONZALEZ RESTREPO",
    identification: "1214739016",
    email: "brayangonzalez@empresa.com",
    mobile: "2112810",
    address: "CR 39 N 72 15",
    cargo: "AUXILIAR OPERATIVO",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0025",
    name: "LUISA FERNANDAN OTALVARO RODAS",
    identification: "1026132547",
    email: "luisaotalvaro@empresa.com",
    mobile: "3218691406",
    address: "CR 40 N 51 - 177",
    cargo: "AUXILIAR OPERATIVO",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0026",
    name: "ALLAN SANTIAGO ZAPATA SALAZAR",
    identification: "1020466949",
    email: "sanapo.0320@gmail.com",
    mobile: "3216984848",
    address: "CLL 83A N 36C 21",
    cargo: "EJECUTIVO DE VENTAS",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0027",
    name: "ALEJANDRA JULIETH DIAZ HERNANDEZ",
    identification: "1036616937",
    email: "doremidaenelsolfa@gmail.com",
    mobile: "3028059918",
    address: "CR 35 N 41 27",
    cargo: "DISEÑADOR GRAFICO COMERCIAL",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0028",
    name: "HENRY ALEXIS MESA MONSALVE",
    identification: "1152191643",
    email: "mesamonsalvehenry@gmail.com",
    mobile: "3174471727",
    address: "CR 95 N 47A 60",
    cargo: "COMMUNITY MANAGER",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0029",
    name: "DAVID ALEJANDRO SALDARRIAGA RIOS",
    identification: "1000192462",
    email: "alejorios3312@gmail.com",
    mobile: "3122848655",
    address: "CLL 75C N 32 74",
    cargo: "AUXILIAR OPERATIVO",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0030",
    name: "YORMAN JOSUE GOMEZ SALAZAR",
    identification: "1348434",
    email: "josuecuentacuentos@gmail.com",
    mobile: "3124146142",
    address: "CLL 57C N 31 - 119",
    cargo: "DISEÑADOR GRAFICO",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0031",
    name: "CARLOS AMADO TABORDA ECHEVERRI",
    identification: "98607493",
    email: "taborda0601@hotmail.com",
    mobile: "3153055696",
    address: "CR 45 N 40A 27",
    cargo: "LIDER DE BODEGA",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0032",
    name: "GINE ALEJANDRA LADINO VARGAS",
    identification: "1000416801",
    email: "gialeja13@gmail.com",
    mobile: "3125531229",
    address: "CR 76 CLL 104A 12",
    cargo: "DISEÑADORA DE MONTAJE",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0033",
    name: "YERALDIN MOSCOSO ARIAS",
    identification: "1040573238",
    email: "yeraldinarias38@gmail.com",
    mobile: "3248638192",
    address: "CR 40 N 51 - 83",
    cargo: "AUXILIAR OPERATIVO ( SUBLIMACIÓN)",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0034",
    name: "VALENTINA BARRERA BOTERO",
    identification: "1000836646",
    email: "valentinabarrera4@gmail.com",
    mobile: "3249470313",
    address: "CR 83 CL 92D N 73",
    cargo: "AUXILIAR DE PLOTTER",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0035",
    name: "TATIANA MARIA BUSTAMANTE HERNANDEZ",
    identification: "21424578",
    email: "tbustamante549@gmail.com",
    mobile: "3332258600",
    address: "CR 35 N 41 - 27",
    cargo: "AUXILIAR DE SERVICIOS GENERALES",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0036",
    name: "ELEIDYS CALDERIN NADAD",
    identification: "1063651775",
    email: "eleidyscalderin@gmail.com",
    mobile: "3186236167",
    address: "CLL 83A N 36C 21",
    cargo: "AUXILIAR DE CORTE Y TRAZO",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0037",
    name: "NATALIA CASTAÑEDA NARVAEZ",
    identification: "1000895203",
    email: "Nacana084@gmail.com",
    mobile: "3226111966",
    address: "Calle 76 # 80-205",
    cargo: "ASISTENTE EN VENTAS",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0038",
    name: "JUAN PABLO BENAVIDES ARIAS",
    identification: "1036669628",
    email: "juanbena.96@hotmail.com",
    mobile: "3014715001",
    address: "DIAGONAL 40 N 37 - 17",
    cargo: "TECNÓLOGO EN LOGISTICA",
    contractType: "APRENDIZAJE",
  },
  {
    employeeCode: "EMP0039",
    name: "JUAN JOSE OCAMPO PAEZ",
    identification: "1000862597",
    email: "juanjoseocampo51@gmail.com",
    mobile: "3214549249",
    address: "CLL 103 N 68A 58",
    cargo: "APRENDIZ EN DESARROLLO DE MEDIOS GRAFICOS",
    contractType: "APRENDIZAJE",
  },
  {
    employeeCode: "EMP0040",
    name: "JUAN JOSE BUSTAMANTE HERNANDEZ",
    identification: "1193630748",
    email: "sbhjjbh1@gmail.com",
    mobile: "3017422231",
    address: "AVENIDA 44a # 63-20",
    cargo: "AUXILIAR OPERATIVO",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0041",
    name: "JAMES MAURICIO GONZALEZ RIVERA",
    identification: "1037608041",
    email: "jamesgonzalez@empresa.com",
    mobile: null,
    address: null,
    cargo: "ASISTENTE COMERCIAL",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0042",
    name: "VALENTINA VALENCIA QUINTERO",
    identification: "1020496424",
    email: "valentinavqjj999@gmail.com",
    mobile: "3238058367",
    address: "CR 35 N 41 - 27",
    cargo: "AUXILIAR OPERATIVA DE SUBLIMACIÓN",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0043",
    name: "KATHERINE CANO OVIEDO",
    identification: "1036653280",
    email: "Katherinkano@gmail.com",
    mobile: "3024275697",
    address: "CALLE 76 # 57-311 APTO 291",
    cargo: "AUXILIAR OPERATIVO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0044",
    name: "JHON ALEXANDER BERRIO CASTAÑO",
    identification: "1037633517",
    email: "alexcastaño0426@gmail.com",
    mobile: "3112000547",
    address: "CALLE 40 C SUR 24 B 105",
    cargo: "LIDER DE CONTROL INTERNO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0045",
    name: "ANDRES FELIPE ECHAVARRIA GOMEZ",
    identification: "1013341759",
    email: "felipithoandresitho5@gmial.com",
    mobile: "3011379140",
    address: "CARRERA 36 C # 78-09",
    cargo: "AUXILIAR OPERATIVO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0046",
    name: "JONATHNA NARVAEZ GARCIA",
    identification: "98709262",
    email: "naevaezjonathan377@gmail.com",
    mobile: "3182416224",
    address: "cra 52d #8108",
    cargo: "AUXILIAR DE CORTE Y TRAZO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0047",
    name: "LARRY JEFERSON CUESTA SERNA",
    identification: "1045141388",
    email: "larry.cuse@gmail.com",
    mobile: "3102246113",
    address: "CALLE 20 # 88-51",
    cargo: "AUXILIAR DE BODEGA DE DESPACHO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0048",
    name: "JUAN PABLO JIMENEZ ZAPATA",
    identification: "1000446230",
    email: "zapatajuanpablo89@gmail.com",
    mobile: "3006889511",
    address: "CARRERA 49 # 106-44",
    cargo: "CONDUCTOR",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0049",
    name: "YERALDIN MOSCOSO ARIAS (REINGRESO)",
    identification: "1040573238",
    email: "yeraldinarias38@gmail.com",
    mobile: "3248638192",
    address: "CR 40 N 51 - 83",
    cargo: "AUXILIAR OPERATIVO",
    contractType: "INDEFINIDO",
  },
];

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function resolveRoleName(cargo: string) {
  const normalized = normalizeKey(cargo);

  // Regla de negocio pedida: cualquier cargo de operario queda con rol OPERARIO.
  if (normalized.includes("OPERARI")) {
    return "OPERARIO";
  }

  // Consolidacion operativa: cargos operativos auxiliares y conductor.
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

function dedupeByIdentification(rows: ActiveEmployee[]) {
  const byIdentification = new Map<string, ActiveEmployee>();

  for (const row of rows) {
    // Mantiene el ultimo registro por identificacion (reingresos sobrescriben).
    byIdentification.set(row.identification, row);
  }

  return [...byIdentification.values()];
}

function buildUsername(emp: ActiveEmployee) {
  return `u${emp.identification}`.slice(0, 32).toLowerCase();
}

function buildPassword(emp: ActiveEmployee) {
  const tail = emp.identification.slice(-4).padStart(4, "0");

  return `Vio*${tail}A`;
}

function mapContractType(raw: RawContractType): EmployeeContractType {
  if (raw === "INDEFINIDO") return "INDEFINITE_TERM";
  if (raw === "FIJO") return "FIXED_TERM";
  return "FIXED_TERM";
}

export async function seedEmployeesUsers() {
  const dedupedEmployees = dedupeByIdentification(activeEmployees);
  const roleNames = [
    ...new Set(dedupedEmployees.map((row) => resolveRoleName(row.cargo))),
  ];

  const roleIdByName: Record<string, string> = {};

  console.log("== Seed empleados + usuarios ==");
  console.log(`Registros originales: ${activeEmployees.length}`);
  console.log(`Registros unicos CC:   ${dedupedEmployees.length}`);

  for (const roleName of roleNames) {
    const existing = await iamDb
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (existing.length > 0) {
      roleIdByName[roleName] = existing[0].id;
      continue;
    }

    const inserted = await iamDb
      .insert(roles)
      .values({ name: roleName })
      .returning({ id: roles.id });

    roleIdByName[roleName] = inserted[0].id;
  }

  let usersInserted = 0;
  let usersReused = 0;
  let employeesInserted = 0;
  let employeesUpdated = 0;

  const credentials: Array<{
    employeeCode: string;
    name: string;
    username: string;
    password: string;
    role: string;
  }> = [];

  for (const emp of dedupedEmployees) {
    const username = buildUsername(emp);
    const password = buildPassword(emp);
    const passwordHash = await bcrypt.hash(password, 10);
    const roleName = resolveRoleName(emp.cargo);
    const roleId = roleIdByName[roleName];
    const contractType = mapContractType(emp.contractType);
    const normalizedEmail = emp.email.trim().toLowerCase();

    let userId: string;

    const existingUser = await iamDb
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      usersReused++;

      await iamDb
        .update(users)
        .set({
          username,
          passwordHash,
          isActive: true,
          emailVerified: true,
        })
        .where(eq(users.id, userId));
    } else {
      const insertedUser = await iamDb
        .insert(users)
        .values({
          username,
          email: normalizedEmail,
          passwordHash,
          isActive: true,
          emailVerified: true,
        })
        .returning({ id: users.id });

      userId = insertedUser[0].id;
      usersInserted++;
    }

    const existingEmployee = await erpDb
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.identification, emp.identification))
      .limit(1);

    const employeePayload = {
      userId,
      employeeCode: emp.employeeCode,
      name: emp.name,
      identificationType: "CC" as const,
      identification: emp.identification,
      email: normalizedEmail,
      mobile: emp.mobile ?? undefined,
      fullMobile: emp.mobile ? `57${emp.mobile}` : undefined,
      address: emp.address ?? undefined,
      city: "Medellin",
      department: "ANTIOQUIA",
      contractType,
      roleId,
      isActive: true,
      intlDialCode: "57",
    };

    if (existingEmployee.length > 0) {
      await erpDb
        .update(employees)
        .set(employeePayload)
        .where(eq(employees.id, existingEmployee[0].id));

      employeesUpdated++;
    } else {
      await erpDb.insert(employees).values(employeePayload);
      employeesInserted++;
    }

    credentials.push({
      employeeCode: emp.employeeCode,
      name: emp.name,
      username,
      password,
      role: roleName,
    });
  }

  console.log("\n== Resultado ==");
  console.log(`Users insertados: ${usersInserted}`);
  console.log(`Users reutilizados: ${usersReused}`);
  console.log(`Employees insertados: ${employeesInserted}`);
  console.log(`Employees actualizados: ${employeesUpdated}`);

  console.log("\n== Credenciales (username | password | role) ==");
  for (const row of credentials) {
    console.log(
      `${row.employeeCode} | ${row.username} | ${row.password} | ${row.role}`,
    );
  }

  return credentials;
}

if (require.main === module) {
  seedEmployeesUsers().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
