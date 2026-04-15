import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import xlsx from "xlsx";

import { erpDb, iamDb } from "@/src/db";
import { roles, users } from "@/src/db/iam/schema";
import {
  confectionists,
  employees,
  packers,
  roles as erpRoles,
} from "@/src/db/schema";


const CREDENTIALS_EXCEL_PATH = path.resolve(
  process.cwd(),
  "db/seeds/credenciales-usuarios.xlsx",
);

type IdType = "CC" | "NIT" | "CE" | "PAS" | "EMPRESA_EXTERIOR";
type TaxRegime = "REGIMEN_COMUN" | "REGIMEN_SIMPLIFICADO" | "NO_RESPONSABLE";

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

const DEFAULT_CONFECTIONISTS_XLSX_PATH =
  "D:/Programación/Vio/INFORMACION DE CONFECCIONISTAS.xlsx";

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
  contractType: "INDEFINIDO" | "FIJO" | "APRENDIZAJE";
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

// Mapping de roles en inglés a nombres en español para contraseña
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
  CONFECCIONISTA: "Confeccionista",
  EMPAQUE: "Empaque",
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
    name: "MANUEL GILBERTO DURAN VILLA",
    identification: "1002303920",
    email: "manuduran@empresa.com",
    mobile: "3216702040",
    address: "CR 42 N 51 - 82",
    cargo: "OPERARIO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0019",
    name: "MARIA EUGENIA POSADA CARDONA",
    identification: "43430898",
    email: "mariaposada@empresa.com",
    mobile: "3106589241",
    address: "CLL 43 N 56 - 20",
    cargo: "ASESOR COMERCIAL",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0020",
    name: "MARIA ELENA FRANCO CORREA",
    identification: "43451124",
    email: "mariafranco@empresa.com",
    mobile: "3008891213",
    address: "CL 41 N 53 - 25",
    cargo: "AUXILIAR OPERATIVA",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0021",
    name: "MARIO ALBERTO GIRALDO",
    identification: "1001256854",
    email: "mariogiraldo@empresa.com",
    mobile: "3217654321",
    address: "AV 80 N 53 - 25",
    cargo: "LIDER DE PRODUCCIÓN",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0022",
    name: "SANDRA LILIANA CIFUENTES RUIZ",
    identification: "1036658789",
    email: "sandraliliana@empresa.com",
    mobile: "3159876543",
    address: "CL 85 N 48 - 15",
    cargo: "LIDER DE BODEGA",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0023",
    name: "SANTIAGO CASTRILLON GOMEZ",
    identification: "1003259876",
    email: "santiagomez@empresa.com",
    mobile: "3215555666",
    address: "CR 51 N 54 - 23",
    cargo: "AUXILIAR OPERATIVO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0024",
    name: "SERGIO LUIS CORRALES",
    identification: "1015897432",
    email: "sergiocorrales@empresa.com",
    mobile: "3206789012",
    address: "CL 33 N 77A 30",
    cargo: "AUXILIAR DE CORTE Y TRAZO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0025",
    name: "MONICA ANDREA GUERRA PAREDES",
    identification: "1020344567",
    email: "monicaguerra@empresa.com",
    mobile: "3188765432",
    address: "CR 45 N 52 - 10",
    cargo: "LIDER DE DESPACHO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0026",
    name: "NICOLAS RUIZ ATEHORTUA",
    identification: "1124567890",
    email: "nicolasruiz@empresa.com",
    mobile: "3104321098",
    address: "CL 65 N 39 - 45",
    cargo: "OPERARIO",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0027",
    name: "OSCAR DAVID REYES SALINAS",
    identification: "65432100",
    email: "oscarreyes@empresa.com",
    mobile: "3215432109",
    address: "AV 44 N 51 - 20",
    cargo: "AUXILIAR DE PLOTTER",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0028",
    name: "PATRICIA HENAO ARENAS",
    identification: "52987654",
    email: "patriciaheneao@empresa.com",
    mobile: "3108765432",
    address: "CL 76 N 43 - 08",
    cargo: "AUXILIAR OPERATIVA",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0029",
    name: "PAULA ANDREA RESTREPO GARCIA",
    identification: "1036598765",
    email: "paularestrepo@empresa.com",
    mobile: "3206543210",
    address: "CR 53 N 54B 60",
    cargo: "AUXILIAR OPERATIVA DE SUBLIMACIÓN",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0030",
    name: "PATRICIA FERNANDA TORRES",
    identification: "45678923",
    email: "patfernanda@empresa.com",
    mobile: "3145678901",
    address: "CL 41 N 52 - 17",
    cargo: "OPERARIA",
    contractType: "INDEFINIDO",
  },
  {
    employeeCode: "EMP0031",
    name: "RAPHAEL RAMIREZ ECHEVERRI",
    identification: "1002547896",
    email: "raphaelram@empresa.com",
    mobile: "3215678904",
    address: "CR 43 N 83 - 25",
    cargo: "AUXILIAR OPERATIVO ( SUBLIMACIÓN)",
    contractType: "FIJO",
  },
  {
    employeeCode: "EMP0032",
    name: "ROSA ELENA MUÑOZ RIVERA",
    identification: "1001786542",
    email: "rosamunoz@empresa.com",
    mobile: "3126789012",
    address: "AV 45 N 31 - 48",
    cargo: "AUXILIAR OPERATIVA",
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
];

// Empacadores de ejemplo
const samplePackers = [
  {
    name: "JUAN CARLOS PEREZ",
    identification: "1001234567",
    email: "juancarlos.perez@example.com",
    address: "CL 33 N 77 - 40",
    specialty: "Etiquetado",
  },
  {
    name: "MARIA JOSE TORRES",
    identification: "1002345678",
    email: "mariajose.torres@example.com",
    address: "CR 45 N 52 - 50",
    specialty: "Prenda colgada",
  },
  {
    name: "CARLOS ALBERTO RUIZ",
    identification: "1003456789",
    email: "carlosa.ruiz@example.com",
    address: "AV 80 N 53 - 60",
    specialty: "Caja master",
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
    const identification = compact.replace(/^CE/, "").replace(/[^A-Z0-9]+/g, "");

    if (!identification) throw new Error(`Documento CE invalido: ${raw}`);

    return { identificationType: "CE", identification, dv: null };
  }

  if (compact.startsWith("PAS")) {
    const identification = compact.replace(/^PAS/, "").replace(/[^A-Z0-9]+/g, "");

    if (!identification) throw new Error(`Documento PAS invalido: ${raw}`);

    return { identificationType: "PAS", identification, dv: null };
  }

  if (compact.startsWith("NIT")) {
    const rest = compact.replace(/^NIT/, "");
    const [base, dvRaw] = rest.split("-");
    const identification = String(base ?? "").replace(/\D+/g, "");
    const dv = String(dvRaw ?? "").replace(/\D+/g, "").slice(0, 1);

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

function loadConfectionistsFromExcel(filePath: string): ConfectionistExcelRow[] {
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
        pickValue(normalizedRow, ["CEDULA O NIT", "CE DULA O NIT", "DOCUMENTO"]),
      );
    } catch {
      parsedDocument = {
        identificationType: "CC",
        identification: "",
        dv: null,
      };
      console.warn(`Documento invalido en Excel, se inventara identificacion para: ${name}`);
    }

    const address = normalizeText(normalizedRow["DIRECCION"]) || "SIN DIRECCION";

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

function dedupeByIdentification(rows: ActiveEmployee[]) {
  const byIdentification = new Map<string, ActiveEmployee>();

  for (const row of rows) {
    byIdentification.set(row.identification, row);
  }

  return [...byIdentification.values()];
}

/**
 * Genera username: 1ra letra nombre + 1er apellido + 2 últimos dígitos
 */
function buildUsername(emp: ActiveEmployee): string {
  const nameParts = emp.name.trim().split(/\s+/);
  const firstName = nameParts[0] ? nameParts[0][0].toLowerCase() : "";
  const lastName = nameParts[1] ? nameParts[1].toLowerCase() : "";
  const lastTwoDigits = emp.identification.slice(-2);

  return `${firstName}${lastName}${lastTwoDigits}`.toLowerCase();
}

/**
 * Genera password: Role + "2026" + ".**"
 */
function buildPassword(emp: ActiveEmployee, roleName: string): string {
  const passwordName = ROLE_TO_PASSWORD_NAME[roleName] || roleName;

  return `${passwordName}2026.**`;
}

function mapContractType(raw: string): EmployeeContractType {
  if (raw === "INDEFINIDO") return "INDEFINITE_TERM";
  if (raw === "FIJO") return "FIXED_TERM";

  return "FIXED_TERM";
}

export async function cleanReseedEmployeesUsers() {
  const dedupedEmployees = dedupeByIdentification(activeEmployees);
  const excelConfectionists = loadConfectionistsFromExcel(
    DEFAULT_CONFECTIONISTS_XLSX_PATH,
  );
  const roleNames = [
    ...new Set(dedupedEmployees.map((row) => resolveRoleName(row.cargo))),
  ];

  console.log("\n🧹 AQUI VAMOS: Limpiando base de datos...\n");
  console.log("📊 Estadísticas iniciales:");
  console.log(`   - Registros empleados originales: ${activeEmployees.length}`);
  console.log(
    `   - Registros únicos por identificación: ${dedupedEmployees.length}`,
  );
  console.log(`   - Roles a procesar: ${roleNames.length}`);
  console.log(`   - Confeccionistas en Excel: ${excelConfectionists.length}`);

  // Limpiar tablas relacionadas en orden (por FKs)
  console.log("\n🗑️  Limpiando tablas en cascada...");

  // Desahbi litar temporalmente las constraints de FK
  console.log("   ⚙️  Deshabilitando constraints de FK...");
  try {
    await erpDb.execute(
      sql.raw("ALTER TABLE employees DISABLE TRIGGER ALL"),
    );
    await erpDb.execute(
      sql.raw("ALTER TABLE orders DISABLE TRIGGER ALL"),
    );
    await erpDb.execute(
      sql.raw("ALTER TABLE designs DISABLE TRIGGER ALL"),
    );
    await erpDb.execute(
      sql.raw("SET CONSTRAINTS ALL DEFERRED"),
    );
  } catch (e) {
    console.log("   ⚠️  No se pudieron deshabilitar triggers");
  }

  // Limpiar todas las tablas que hacen referencia a employees
  const tablesToClean = [
    "colillas_pago",
    "hcm_pre_asientos",
    "employee_requests",
    "orders",
    "designs",
    "order_items",
    "order_item_confection",
    "order_item_packer",
    "accounting_entries",
    "order_item_designer_notes",
  ];

  for (const table of tablesToClean) {
    try {
      await erpDb.execute(sql.raw(`DELETE FROM "${table}"`));
      console.log(`   ✓ Tabla ${table} limpiada`);
    } catch (e: any) {
      // Ignorar errores silenciosamente para tablas que no existen
      // console.log(`   ⚠️  Error limpiando ${table}`);
    }
  }

  // Limpiar employees
  try {
    await erpDb.execute(sql.raw("DELETE FROM employees"));
    console.log("   ✓ Tabla employees limpiada");
  } catch (e: any) {
    console.log(`   ❌ Error limpiando employees: ${e.message}`);
  }

  // Re-habilitar triggers
  try {
    await erpDb.execute(
      sql.raw("ALTER TABLE employees ENABLE TRIGGER ALL"),
    );
    await erpDb.execute(
      sql.raw("ALTER TABLE orders ENABLE TRIGGER ALL"),
    );
    await erpDb.execute(
      sql.raw("ALTER TABLE designs ENABLE TRIGGER ALL"),
    );
  } catch (e) {
    console.log("   ⚠️  No se pudieron habilitar triggers");
  }

  await iamDb.delete(users);
  console.log("   ✓ Tabla users (IAM) limpiada");

  await erpDb.delete(confectionists);
  console.log("   ✓ Tabla confectionists limpiada");

  await erpDb.delete(packers);
  console.log("   ✓ Tabla packers limpiada");

  // Ensegurar roles
  console.log("\n🛠️  Configurando roles...");
  const roleIdByName: Record<string, string> = {};

  for (const roleName of roleNames) {
    const existing = await iamDb
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    let roleId: string;

    if (existing.length > 0) {
      roleId = existing[0].id;
      console.log(`   ℹ Role "${roleName}" ya existe: ${roleId}`);
    } else {
      const inserted = await iamDb
        .insert(roles)
        .values({ name: roleName })
        .returning({ id: roles.id });

      roleId = inserted[0].id;
      console.log(`   ✓ Role "${roleName}" creado: ${roleId}`);
    }

    // Sincronizar en ERP database
    await erpDb
      .insert(erpRoles)
      .values({ id: roleId, name: roleName })
      .onConflictDoNothing();

    roleIdByName[roleName] = roleId;
  }

  // Ensegurar roles CONFECCIONISTA y EMPAQUE en IAM + ERP
  for (const extraRole of ["CONFECCIONISTA", "EMPAQUE"]) {
    const existingExtra = await iamDb
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, extraRole))
      .limit(1);

    let extraRoleId: string;

    if (existingExtra.length > 0) {
      extraRoleId = existingExtra[0].id;
    } else {
      const inserted = await iamDb
        .insert(roles)
        .values({ name: extraRole })
        .returning({ id: roles.id });

      extraRoleId = inserted[0].id;
      console.log(`   ✓ Role "${extraRole}" creado en IAM: ${extraRoleId}`);
    }

    await erpDb
      .insert(erpRoles)
      .values({ id: extraRoleId, name: extraRole })
      .onConflictDoNothing();

    roleIdByName[extraRole] = extraRoleId;
  }

  console.log(`\n✅ ${roleNames.length + 2} roles procesados\n`);

  // Insertar empleados y usuarios
  console.log("👤 Creando usuarios y empleados...");
  let usersInserted = 0;
  let employeesInserted = 0;

  const credentials: Array<{
    employeeCode: string;
    name: string;
    username: string;
    password: string;
    role: string;
    identification: string;
  }> = [];

  for (const emp of dedupedEmployees) {
    const username = buildUsername(emp);
    const roleName = resolveRoleName(emp.cargo);
    const roleId = roleIdByName[roleName];
    const password = buildPassword(emp, roleName);
    const passwordHash = await bcrypt.hash(password, 10);
    const contractType = mapContractType(emp.contractType);
    const normalizedEmail = emp.email.trim().toLowerCase();

    // Crear/Actualizar usuario en IAM
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

    const userId = insertedUser[0].id;
    usersInserted++;

    // Crear empleado en ERP
    await erpDb.insert(employees).values({
      userId,
      employeeCode: emp.employeeCode,
      name: emp.name,
      identificationType: "CC",
      identification: emp.identification,
      email: normalizedEmail,
      mobile: emp.mobile ?? undefined,
      fullMobile: emp.mobile ? `57${emp.mobile}` : undefined,
      address: emp.address ?? undefined,
      city: "Medellín",
      department: "ANTIOQUIA",
      contractType,
      roleId,
      isActive: true,
      intlDialCode: "57",
    });

    employeesInserted++;

    credentials.push({
      employeeCode: emp.employeeCode,
      name: emp.name,
      username,
      password,
      role: roleName,
      identification: emp.identification,
    });
  }

  console.log(`   ✓ ${usersInserted} usuarios creados`);
  console.log(`   ✓ ${employeesInserted} empleados creados\n`);

  // Crear confeccionistas con us usuarios IAM
  console.log("🧵 Creando confeccionistas...");
  let inventedConfectionistId = 97000000;

  for (let i = 0; i < excelConfectionists.length; i++) {
    const conf = excelConfectionists[i];
    const identification = conf.identification || String(inventedConfectionistId++);
    const username = buildUsername({
      name: conf.name,
      identification,
    } as any);
    const password = buildPassword(
      { name: conf.name, identification } as any,
      "CONFECCIONISTA",
    );
    const passwordHash = await bcrypt.hash(password, 10);
    const confEmail = conf.email ?? `${username}@confeccionistas.viomar.local`;

    // Crear usuario IAM para el confeccionista
    const insertedConfUser = await iamDb
      .insert(users)
      .values({
        username,
        email: confEmail,
        passwordHash,
        isActive: true,
        emailVerified: true,
      })
      .returning({ id: users.id });

    // confUserId reserved for future userId FK on confectionists table
    void insertedConfUser[0].id;

    const confCode = `CONF${String(i + 1).padStart(4, "0")}`;

    await erpDb.insert(confectionists).values({
      confectionistCode: confCode,
      name: conf.name,
      identificationType: conf.identificationType,
      identification,
      dv: conf.dv,
      email: confEmail,
      address: conf.address,
      specialty: conf.neighborhood ?? "CONFECCION",
      taxRegime: taxRegimeFromIdType(conf.identificationType),
      contactName: conf.name,
      mobile: conf.phone,
      fullMobile: conf.phone ? `57${conf.phone}` : undefined,
      accountNumber: normalizeAccountNumber(conf.bankAccount),
      type: "TALLER EXTERNO",
      isActive: true,
      city: "Medellín",
      department: "ANTIOQUIA",
    });

    credentials.push({
      employeeCode: confCode,
      name: conf.name,
      username,
      password,
      role: "CONFECCIONISTA",
      identification,
    });
  }

  console.log(`   ✓ ${excelConfectionists.length} confeccionistas creados desde Excel (con usuario IAM)\n`);

  // Crear empacadores con usuarios IAM
  console.log("📦 Creando empacadores...");
  const packerRoleId = roleIdByName["EMPAQUE"];

  for (let i = 0; i < samplePackers.length; i++) {
    const packer = samplePackers[i];
    const username = buildUsername({
      name: packer.name,
      identification: packer.identification,
    } as any);
    const password = buildPassword(
      { name: packer.name, identification: packer.identification } as any,
      "EMPAQUE",
    );
    const passwordHash = await bcrypt.hash(password, 10);
    const packerEmail = packer.email ?? `${username}@empaque.viomar.local`;

    // Crear usuario IAM para el empacador
    const insertedPackerUser = await iamDb
      .insert(users)
      .values({
        username,
        email: packerEmail,
        passwordHash,
        isActive: true,
        emailVerified: true,
      })
      .returning({ id: users.id });

    // packerUserId reserved for future userId FK on packers table
    void insertedPackerUser[0].id;

    const packerCode = `EMPA${String(i + 1).padStart(4, "0")}`;

    await erpDb.insert(packers).values({
      packerCode,
      name: packer.name,
      identificationType: "CC",
      identification: packer.identification,
      email: packerEmail,
      address: packer.address,
      specialty: packer.specialty,
      isActive: true,
      city: "Medellín",
      department: "ANTIOQUIA",
    });

    credentials.push({
      employeeCode: packerCode,
      name: packer.name,
      username,
      password,
      role: "EMPAQUE",
      identification: packer.identification,
    });
  }

  console.log(`   ✓ ${samplePackers.length} empacadores creados (con usuario IAM)\n`);

  // Mostrar credenciales
  console.log("🔐 Credenciales generadas:");
  console.log("════════════════════════════════════════════════════════════════");
  console.log(
    "Código       | Usuario      | Contraseña           | Rol                   ",
  );
  console.log(
    "════════════════════════════════════════════════════════════════════════════",
  );

  for (const cred of credentials) {
    const padCode = cred.employeeCode.padEnd(12);
    const padUsername = cred.username.padEnd(12);
    const padPassword = cred.password.padEnd(20);
    const padRole = cred.role.padEnd(21);

    console.log(`${padCode} | ${padUsername} | ${padPassword} | ${padRole}`);
  }

  console.log("════════════════════════════════════════════════════════════════\n");

  // Exportar Excel con todas las credenciales
  console.log("\n📋 Exportando Excel de credenciales...");
  const wsData = [
    ["Código", "Nombre", "Username", "Contraseña", "Rol", "Identificación"],
    ...credentials.map((c) => [
      c.employeeCode,
      c.name,
      c.username,
      c.password,
      c.role,
      c.identification,
    ]),
  ];

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet(wsData);

  // Ajustar anchos de columnas
  ws["!cols"] = [
    { wch: 12 },
    { wch: 40 },
    { wch: 18 },
    { wch: 24 },
    { wch: 24 },
    { wch: 16 },
  ];

  xlsx.utils.book_append_sheet(wb, ws, "Credenciales");
  xlsx.writeFile(wb, CREDENTIALS_EXCEL_PATH);
  console.log(`   ✓ Excel guardado en: ${CREDENTIALS_EXCEL_PATH}\n`);

  console.log("✨ ¡Reseed completado exitosamente!");
  console.log(`   - ${usersInserted} usuarios empleados creados`);
  console.log(`   - ${employeesInserted} empleados creados`);
  console.log(`   - ${excelConfectionists.length} confeccionistas creados (con IAM user)`);
  console.log(`   - ${samplePackers.length} empacadores creados (con IAM user)`);
  console.log(`   - Total ${credentials.length} registros con acceso generados\n`);

  return credentials;
}

if (require.main === module) {
  cleanReseedEmployeesUsers().catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
}
