import "dotenv/config";

import { sql } from "drizzle-orm";

import { db } from "@/src/db";
import { accountingAccounts } from "@/src/db/schema";

type NiifTag =
  | "ACTIVO_CORRIENTE"
  | "ACTIVO_NO_CORRIENTE"
  | "PASIVO_CORRIENTE"
  | "PASIVO_NO_CORRIENTE"
  | "PATRIMONIO"
  | "INGRESOS_OPERACIONALES"
  | "COSTO_VENTAS"
  | "GASTOS_OPERACIONALES"
  | "OTROS_INGRESOS"
  | "OTROS_GASTOS"
  | "IMPUESTO_RENTA"
  | null;

interface PucRow {
  codigoPuc: string;
  nombre: string;
  naturaleza: "DEBITO" | "CREDITO";
  tipo: "CLASE" | "GRUPO" | "CUENTA" | "SUBCUENTA";
  parentCodigo: string | null;
  aceptaMovimientos: boolean;
  clasificacionNiif: NiifTag;
}

const PUC_VIOMAR: PucRow[] = [
  { codigoPuc: "1", nombre: "ACTIVO", naturaleza: "DEBITO", tipo: "CLASE", parentCodigo: null, aceptaMovimientos: false, clasificacionNiif: null },
  { codigoPuc: "11", nombre: "Efectivo y equivalentes al efectivo", naturaleza: "DEBITO", tipo: "GRUPO", parentCodigo: "1", aceptaMovimientos: false, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1105", nombre: "Caja general", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "11", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "110505", nombre: "Caja principal Itagüí", naturaleza: "DEBITO", tipo: "SUBCUENTA", parentCodigo: "1105", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1110", nombre: "Bancos", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "11", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "111005", nombre: "Bancolombia cta. corriente", naturaleza: "DEBITO", tipo: "SUBCUENTA", parentCodigo: "1110", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "111010", nombre: "Davivienda cta. ahorros", naturaleza: "DEBITO", tipo: "SUBCUENTA", parentCodigo: "1110", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1115", nombre: "Derechos fiduciarios", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "11", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "13", nombre: "Deudores comerciales y otras cuentas por cobrar", naturaleza: "DEBITO", tipo: "GRUPO", parentCodigo: "1", aceptaMovimientos: false, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1305", nombre: "Clientes nacionales", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "13", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1310", nombre: "Clientes del exterior", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "13", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1345", nombre: "Cuentas por cobrar trabajadores", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "13", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1350", nombre: "Deudores varios", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "13", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1399", nombre: "Provisión deudores comerciales (deterioro)", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "13", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "14", nombre: "Inventarios", naturaleza: "DEBITO", tipo: "GRUPO", parentCodigo: "1", aceptaMovimientos: false, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1405", nombre: "Mercancías — confección y artículos deportivos", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "14", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1410", nombre: "Materias primas e insumos", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "14", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1499", nombre: "Provisión protección inventarios", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "14", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "16", nombre: "Intangibles corrientes", naturaleza: "DEBITO", tipo: "GRUPO", parentCodigo: "1", aceptaMovimientos: false, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1605", nombre: "Intangibles adquiridos CP", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "16", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "17", nombre: "Activos por impuestos corrientes", naturaleza: "DEBITO", tipo: "GRUPO", parentCodigo: "1", aceptaMovimientos: false, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1705", nombre: "Anticipo impuesto de renta", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "17", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1710", nombre: "IVA descontable", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "17", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "18", nombre: "Anticipos y avances", naturaleza: "DEBITO", tipo: "GRUPO", parentCodigo: "1", aceptaMovimientos: false, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "1810", nombre: "Anticipos a proveedores", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "18", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_CORRIENTE" },
  { codigoPuc: "15", nombre: "Propiedad planta y equipo", naturaleza: "DEBITO", tipo: "GRUPO", parentCodigo: "1", aceptaMovimientos: false, clasificacionNiif: "ACTIVO_NO_CORRIENTE" },
  { codigoPuc: "1504", nombre: "Maquinaria y equipo", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "15", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_NO_CORRIENTE" },
  { codigoPuc: "1516", nombre: "Construcciones y edificaciones", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "15", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_NO_CORRIENTE" },
  { codigoPuc: "1524", nombre: "Equipo de computación y comunicación", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "15", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_NO_CORRIENTE" },
  { codigoPuc: "1528", nombre: "Flota y equipo de transporte", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "15", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_NO_CORRIENTE" },
  { codigoPuc: "1540", nombre: "Equipo de oficina", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "15", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_NO_CORRIENTE" },
  { codigoPuc: "1592", nombre: "Depreciación acumulada PP&E", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "15", aceptaMovimientos: true, clasificacionNiif: "ACTIVO_NO_CORRIENTE" },
  { codigoPuc: "2", nombre: "PASIVO", naturaleza: "CREDITO", tipo: "CLASE", parentCodigo: null, aceptaMovimientos: false, clasificacionNiif: null },
  { codigoPuc: "21", nombre: "Obligaciones financieras", naturaleza: "CREDITO", tipo: "GRUPO", parentCodigo: "2", aceptaMovimientos: false, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2105", nombre: "Bancos nacionales corto plazo", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "21", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2115", nombre: "Bancos nacionales largo plazo", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "21", aceptaMovimientos: true, clasificacionNiif: "PASIVO_NO_CORRIENTE" },
  { codigoPuc: "22", nombre: "Proveedores", naturaleza: "CREDITO", tipo: "GRUPO", parentCodigo: "2", aceptaMovimientos: false, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2205", nombre: "Proveedores nacionales", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "22", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2210", nombre: "Proveedores del exterior", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "22", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "23", nombre: "Cuentas por pagar a socios", naturaleza: "CREDITO", tipo: "GRUPO", parentCodigo: "2", aceptaMovimientos: false, clasificacionNiif: "PASIVO_NO_CORRIENTE" },
  { codigoPuc: "2305", nombre: "Cuentas por pagar socio LP", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "23", aceptaMovimientos: true, clasificacionNiif: "PASIVO_NO_CORRIENTE" },
  { codigoPuc: "24", nombre: "Cuentas por pagar y acreedores", naturaleza: "CREDITO", tipo: "GRUPO", parentCodigo: "2", aceptaMovimientos: false, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2405", nombre: "Acreedores comerciales", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "24", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2408", nombre: "IVA descontable (transitoria)", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "24", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2365", nombre: "Retención en la fuente por pagar", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "24", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2368", nombre: "Retención ICA por pagar", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "24", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2370", nombre: "Retención IVA por pagar", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "24", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2380", nombre: "IVA generado por pagar", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "24", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2404", nombre: "Impuesto de renta por pagar", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "24", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "25", nombre: "Obligaciones laborales y beneficios empleados", naturaleza: "CREDITO", tipo: "GRUPO", parentCodigo: "2", aceptaMovimientos: false, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2505", nombre: "Beneficios a empleados por pagar", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "25", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2510", nombre: "Cesantías consolidadas", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "25", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2515", nombre: "Intereses sobre cesantías", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "25", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2520", nombre: "Prima de servicios", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "25", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2525", nombre: "Vacaciones consolidadas", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "25", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "27", nombre: "Otros pasivos no financieros", naturaleza: "CREDITO", tipo: "GRUPO", parentCodigo: "2", aceptaMovimientos: false, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2705", nombre: "Anticipos de clientes", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "27", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "2710", nombre: "Ingresos diferidos", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "27", aceptaMovimientos: true, clasificacionNiif: "PASIVO_CORRIENTE" },
  { codigoPuc: "3", nombre: "PATRIMONIO", naturaleza: "CREDITO", tipo: "CLASE", parentCodigo: null, aceptaMovimientos: false, clasificacionNiif: null },
  { codigoPuc: "31", nombre: "Capital social", naturaleza: "CREDITO", tipo: "GRUPO", parentCodigo: "3", aceptaMovimientos: false, clasificacionNiif: "PATRIMONIO" },
  { codigoPuc: "3115", nombre: "Capital suscrito y pagado (50.004 acciones)", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "31", aceptaMovimientos: true, clasificacionNiif: "PATRIMONIO" },
  { codigoPuc: "32", nombre: "Superávit de capital", naturaleza: "CREDITO", tipo: "GRUPO", parentCodigo: "3", aceptaMovimientos: false, clasificacionNiif: "PATRIMONIO" },
  { codigoPuc: "3205", nombre: "Prima en colocación de acciones", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "32", aceptaMovimientos: true, clasificacionNiif: "PATRIMONIO" },
  { codigoPuc: "37", nombre: "Resultados del ejercicio", naturaleza: "CREDITO", tipo: "GRUPO", parentCodigo: "3", aceptaMovimientos: false, clasificacionNiif: "PATRIMONIO" },
  { codigoPuc: "3705", nombre: "Utilidades acumuladas (ejercicios anteriores)", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "37", aceptaMovimientos: true, clasificacionNiif: "PATRIMONIO" },
  { codigoPuc: "3710", nombre: "Pérdidas acumuladas", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "37", aceptaMovimientos: true, clasificacionNiif: "PATRIMONIO" },
  { codigoPuc: "3715", nombre: "Resultado del ejercicio (corriente)", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "37", aceptaMovimientos: true, clasificacionNiif: "PATRIMONIO" },
  { codigoPuc: "4", nombre: "INGRESOS", naturaleza: "CREDITO", tipo: "CLASE", parentCodigo: null, aceptaMovimientos: false, clasificacionNiif: null },
  { codigoPuc: "41", nombre: "Ingresos operacionales", naturaleza: "CREDITO", tipo: "GRUPO", parentCodigo: "4", aceptaMovimientos: false, clasificacionNiif: "INGRESOS_OPERACIONALES" },
  { codigoPuc: "4135", nombre: "Comercio al por menor — confección / deportivos", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "41", aceptaMovimientos: true, clasificacionNiif: "INGRESOS_OPERACIONALES" },
  { codigoPuc: "4175", nombre: "Prestación de servicios", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "41", aceptaMovimientos: true, clasificacionNiif: "INGRESOS_OPERACIONALES" },
  { codigoPuc: "4190", nombre: "Devoluciones en ventas (débito)", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "41", aceptaMovimientos: true, clasificacionNiif: "INGRESOS_OPERACIONALES" },
  { codigoPuc: "42", nombre: "Otros ingresos", naturaleza: "CREDITO", tipo: "GRUPO", parentCodigo: "4", aceptaMovimientos: false, clasificacionNiif: "OTROS_INGRESOS" },
  { codigoPuc: "4210", nombre: "Ingresos financieros", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "42", aceptaMovimientos: true, clasificacionNiif: "OTROS_INGRESOS" },
  { codigoPuc: "4220", nombre: "Ingresos por recuperaciones", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "42", aceptaMovimientos: true, clasificacionNiif: "OTROS_INGRESOS" },
  { codigoPuc: "4250", nombre: "Ingresos diversos", naturaleza: "CREDITO", tipo: "CUENTA", parentCodigo: "42", aceptaMovimientos: true, clasificacionNiif: "OTROS_INGRESOS" },
  { codigoPuc: "5", nombre: "GASTOS OPERACIONALES", naturaleza: "DEBITO", tipo: "CLASE", parentCodigo: null, aceptaMovimientos: false, clasificacionNiif: null },
  { codigoPuc: "51", nombre: "Gastos de administración y ventas", naturaleza: "DEBITO", tipo: "GRUPO", parentCodigo: "5", aceptaMovimientos: false, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "5105", nombre: "Gastos de personal", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "51", aceptaMovimientos: true, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "5110", nombre: "Honorarios", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "51", aceptaMovimientos: true, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "5115", nombre: "Impuestos locales (ICA, predial, etc.)", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "51", aceptaMovimientos: true, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "5120", nombre: "Arrendamientos", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "51", aceptaMovimientos: true, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "5130", nombre: "Contribuciones y afiliaciones", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "51", aceptaMovimientos: true, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "5135", nombre: "Servicios (vigilancia, aseo, utilities)", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "51", aceptaMovimientos: true, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "5140", nombre: "Gastos legales", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "51", aceptaMovimientos: true, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "5145", nombre: "Mantenimiento y reparaciones", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "51", aceptaMovimientos: true, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "5150", nombre: "Adecuación e instalación", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "51", aceptaMovimientos: true, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "5155", nombre: "Gastos de viaje", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "51", aceptaMovimientos: true, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "5160", nombre: "Depreciación y amortización", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "51", aceptaMovimientos: true, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "5162", nombre: "Gastos de importación", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "51", aceptaMovimientos: true, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "5165", nombre: "Gastos diversos", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "51", aceptaMovimientos: true, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "5195", nombre: "Seguros", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "51", aceptaMovimientos: true, clasificacionNiif: "GASTOS_OPERACIONALES" },
  { codigoPuc: "53", nombre: "Otros gastos no operacionales", naturaleza: "DEBITO", tipo: "GRUPO", parentCodigo: "5", aceptaMovimientos: false, clasificacionNiif: "OTROS_GASTOS" },
  { codigoPuc: "5305", nombre: "Gastos financieros e intereses", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "53", aceptaMovimientos: true, clasificacionNiif: "OTROS_GASTOS" },
  { codigoPuc: "5310", nombre: "Gastos extraordinarios", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "53", aceptaMovimientos: true, clasificacionNiif: "OTROS_GASTOS" },
  { codigoPuc: "5315", nombre: "Gastos diversos no operacionales", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "53", aceptaMovimientos: true, clasificacionNiif: "OTROS_GASTOS" },
  { codigoPuc: "54", nombre: "Impuesto de renta y complementarios", naturaleza: "DEBITO", tipo: "GRUPO", parentCodigo: "5", aceptaMovimientos: false, clasificacionNiif: "IMPUESTO_RENTA" },
  { codigoPuc: "5405", nombre: "Impuesto de renta corriente", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "54", aceptaMovimientos: true, clasificacionNiif: "IMPUESTO_RENTA" },
  { codigoPuc: "6", nombre: "COSTO DE VENTAS Y PRESTACIÓN DE SERVICIOS", naturaleza: "DEBITO", tipo: "CLASE", parentCodigo: null, aceptaMovimientos: false, clasificacionNiif: null },
  { codigoPuc: "61", nombre: "Costo de mercancía vendida", naturaleza: "DEBITO", tipo: "GRUPO", parentCodigo: "6", aceptaMovimientos: false, clasificacionNiif: "COSTO_VENTAS" },
  { codigoPuc: "6135", nombre: "CMV — confección y artículos deportivos", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "61", aceptaMovimientos: true, clasificacionNiif: "COSTO_VENTAS" },
  { codigoPuc: "6155", nombre: "CMV — prestación de servicios", naturaleza: "DEBITO", tipo: "CUENTA", parentCodigo: "61", aceptaMovimientos: true, clasificacionNiif: "COSTO_VENTAS" },
];

function resolveAccountType(code: string) {
  switch (code.charAt(0)) {
    case "1":
      return "ASSET" as const;
    case "2":
      return "LIABILITY" as const;
    case "3":
      return "EQUITY" as const;
    case "4":
      return "REVENUE" as const;
    case "5":
      return "EXPENSE" as const;
    case "6":
      return "COST" as const;
    default:
      return "MEMO" as const;
  }
}

function resolveNormalBalance(value: PucRow["naturaleza"]) {
  return value === "DEBITO" ? "DEBIT" as const : "CREDIT" as const;
}

async function runSeedPuc() {
  console.log(`Insertando ${PUC_VIOMAR.length} cuentas del PUC...`);

  const batchSize = 20;
  for (let index = 0; index < PUC_VIOMAR.length; index += batchSize) {
    const batch = PUC_VIOMAR.slice(index, index + batchSize);

    await db
      .insert(accountingAccounts)
      .values(
        batch.map((row) => ({
          code: row.codigoPuc,
          name: row.nombre,
          type: resolveAccountType(row.codigoPuc),
          normalBalance: resolveNormalBalance(row.naturaleza),
          parentCode: row.parentCodigo,
          accountLevel: row.tipo,
          niifClassification: row.clasificacionNiif,
          isPostable: row.aceptaMovimientos,
          isActive: true,
        })),
      )
      .onConflictDoUpdate({
        target: accountingAccounts.code,
        set: {
          name: sql`excluded.name`,
          type: sql`excluded.type`,
          normalBalance: sql`excluded.normal_balance`,
          parentCode: sql`excluded.parent_code`,
          accountLevel: sql`excluded.account_level`,
          niifClassification: sql`excluded.niif_classification`,
          isPostable: sql`excluded.is_postable`,
          isActive: sql`excluded.is_active`,
        },
      });

    console.log(`  Lote ${Math.floor(index / batchSize) + 1} OK (${batch.length} cuentas)`);
  }

  console.log(`✓ PUC Viomar cargado correctamente (${PUC_VIOMAR.length} cuentas).`);
}

runSeedPuc()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit();
  });