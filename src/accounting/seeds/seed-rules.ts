import "dotenv/config";

import { sql } from "drizzle-orm";

import { db } from "@/src/db";
import { accountingRuleDefinitions } from "@/src/db/schema";

const RULES = [
  { sourceModule: "SALES", sourceType: "PREFACTURA", event: "APROBACION", sortOrder: 1, descriptionTemplate: "Venta — cargo a clientes por subtotal", debitAccountCode: "1305", creditAccountCode: "4135", amountField: "subtotal" },
  { sourceModule: "SALES", sourceType: "PREFACTURA", event: "APROBACION", sortOrder: 2, descriptionTemplate: "Venta — IVA generado 19%", debitAccountCode: "1305", creditAccountCode: "2380", amountField: "ivaAmount" },
  { sourceModule: "SALES", sourceType: "PREFACTURA", event: "APROBACION", sortOrder: 3, descriptionTemplate: "Retención en la fuente practicada por cliente", debitAccountCode: "2365", creditAccountCode: "1305", amountField: "withholdingTaxAmount" },
  { sourceModule: "SALES", sourceType: "PREFACTURA", event: "APROBACION", sortOrder: 4, descriptionTemplate: "Retención ICA practicada por cliente", debitAccountCode: "2368", creditAccountCode: "1305", amountField: "withholdingIcaAmount" },
  { sourceModule: "SALES", sourceType: "PREFACTURA", event: "APROBACION", sortOrder: 5, descriptionTemplate: "Retención IVA practicada por cliente (15%)", debitAccountCode: "2370", creditAccountCode: "1305", amountField: "withholdingIvaAmount" },
  { sourceModule: "INVENTORY", sourceType: "PREFACTURA", event: "COSTO_VENTA", sortOrder: 1, descriptionTemplate: "Costo de mercancía vendida — descarga inventario", debitAccountCode: "6135", creditAccountCode: "1405", amountField: "totalProducts" },
  { sourceModule: "SALES", sourceType: "PREFACTURA", event: "ANULACION", sortOrder: 1, descriptionTemplate: "NC — devolución subtotal a cliente", debitAccountCode: "4190", creditAccountCode: "1305", amountField: "subtotal" },
  { sourceModule: "SALES", sourceType: "PREFACTURA", event: "ANULACION", sortOrder: 2, descriptionTemplate: "NC — reversa IVA generado", debitAccountCode: "2380", creditAccountCode: "1305", amountField: "ivaAmount" },
  { sourceModule: "INVENTORY", sourceType: "PREFACTURA", event: "ANULACION", sortOrder: 3, descriptionTemplate: "NC — reversa ingreso inventario", debitAccountCode: "1405", creditAccountCode: "6135", amountField: "totalProducts" },
  { sourceModule: "TREASURY", sourceType: "CASH_RECEIPT", event: "CONFIRMACION", sortOrder: 1, descriptionTemplate: "Recibo de caja — cobro cartera clientes", debitAccountCode: "1110", creditAccountCode: "1305", amountField: "amountReceived" },
  { sourceModule: "PURCHASING", sourceType: "SUPPLIER_INVOICE", event: "REGISTRO", sortOrder: 1, descriptionTemplate: "Compra mercancía — cargo a inventario", debitAccountCode: "1405", creditAccountCode: "2205", amountField: "subtotal" },
  { sourceModule: "PURCHASING", sourceType: "SUPPLIER_INVOICE", event: "REGISTRO", sortOrder: 2, descriptionTemplate: "Compra mercancía — IVA descontable", debitAccountCode: "1710", creditAccountCode: "2205", amountField: "ivaAmount" },
  { sourceModule: "TREASURY", sourceType: "SUPPLIER_PAYMENT", event: "PAGO", sortOrder: 1, descriptionTemplate: "Pago a proveedor — débito CxP", debitAccountCode: "2205", creditAccountCode: "1110", amountField: "amount" },
  { sourceModule: "PAYROLL", sourceType: "PAYROLL", event: "PROVISION", sortOrder: 1, descriptionTemplate: "Provisión nómina — gasto de personal", debitAccountCode: "5105", creditAccountCode: "2505", amountField: "totalAmount" },
  { sourceModule: "PAYROLL", sourceType: "PAYROLL", event: "PROVISION", sortOrder: 2, descriptionTemplate: "Provisión prestaciones sociales — cesantías", debitAccountCode: "5105", creditAccountCode: "2510", amountField: "cesantiasAmount" },
  { sourceModule: "PAYROLL", sourceType: "PAYROLL", event: "PROVISION", sortOrder: 3, descriptionTemplate: "Provisión vacaciones", debitAccountCode: "5105", creditAccountCode: "2525", amountField: "vacacionesAmount" },
  { sourceModule: "PAYROLL", sourceType: "PAYROLL", event: "PAGO", sortOrder: 1, descriptionTemplate: "Dispersión nómina — pago neto empleados", debitAccountCode: "2505", creditAccountCode: "1110", amountField: "netAmount" },
  { sourceModule: "INVENTORY", sourceType: "STOCK_MOVEMENT", event: "AJUSTE_POSITIVO", sortOrder: 1, descriptionTemplate: "Ajuste positivo inventario — ingreso por sobrante", debitAccountCode: "1405", creditAccountCode: "4250", amountField: "valor" },
  { sourceModule: "INVENTORY", sourceType: "STOCK_MOVEMENT", event: "AJUSTE_NEGATIVO", sortOrder: 1, descriptionTemplate: "Ajuste negativo inventario — gasto por faltante", debitAccountCode: "5165", creditAccountCode: "1405", amountField: "valor" },
  { sourceModule: "TREASURY", sourceType: "PETTY_CASH", event: "GASTO", sortOrder: 1, descriptionTemplate: "Gasto caja menor", debitAccountCode: "5165", creditAccountCode: "1105", amountField: "amount" },
  { sourceModule: "TREASURY", sourceType: "FACTORING", event: "CESION", sortOrder: 1, descriptionTemplate: "Factoring — ingreso neto recibido por banco", debitAccountCode: "1110", creditAccountCode: "1305", amountField: "netAmountReceived" },
  { sourceModule: "TREASURY", sourceType: "FACTORING", event: "CESION", sortOrder: 2, descriptionTemplate: "Factoring — costo financiero descuento", debitAccountCode: "5305", creditAccountCode: "1305", amountField: "discountAmount" },
  { sourceModule: "GENERAL", sourceType: "MANUAL", event: "DEPRECIACION", sortOrder: 1, descriptionTemplate: "Depreciación mensual PP&E", debitAccountCode: "5160", creditAccountCode: "1592", amountField: "monto" },
  { sourceModule: "TAX", sourceType: "MANUAL", event: "LIQUIDACION_IVA", sortOrder: 1, descriptionTemplate: "Liquidación bimestral IVA — saldo a pagar", debitAccountCode: "2380", creditAccountCode: "2404", amountField: "monto" },
  { sourceModule: "GENERAL", sourceType: "CLOSURE", event: "CIERRE_RESULTADOS", sortOrder: 1, descriptionTemplate: "Cierre anual — ingresos a resultado ejercicio", debitAccountCode: "4135", creditAccountCode: "3715", amountField: "totalIngresos" },
  { sourceModule: "GENERAL", sourceType: "CLOSURE", event: "CIERRE_RESULTADOS", sortOrder: 2, descriptionTemplate: "Cierre anual — costo ventas a resultado ejercicio", debitAccountCode: "3715", creditAccountCode: "6135", amountField: "totalCostos" },
  { sourceModule: "GENERAL", sourceType: "CLOSURE", event: "CIERRE_RESULTADOS", sortOrder: 3, descriptionTemplate: "Cierre anual — gastos operac. a resultado ejercicio", debitAccountCode: "3715", creditAccountCode: "5105", amountField: "totalGastos" },
  { sourceModule: "GENERAL", sourceType: "CLOSURE", event: "TRASLADO_UTILIDADES", sortOrder: 1, descriptionTemplate: "Traslado utilidad ejercicio a utilidades acumuladas", debitAccountCode: "3715", creditAccountCode: "3705", amountField: "utilidad" },
  { sourceModule: "TAX", sourceType: "CLOSURE", event: "IMPUESTO_RENTA", sortOrder: 1, descriptionTemplate: "Liquidación impuesto de renta corriente", debitAccountCode: "5405", creditAccountCode: "2404", amountField: "impuestoRenta" },
] as const;

async function runSeedRules() {
  console.log(`Insertando ${RULES.length} reglas contables...`);

  await db
    .insert(accountingRuleDefinitions)
    .values(RULES.map((rule) => ({ ...rule, isActive: true })))
    .onConflictDoUpdate({
      target: [
        accountingRuleDefinitions.sourceType,
        accountingRuleDefinitions.event,
        accountingRuleDefinitions.sortOrder,
      ],
      set: {
        sourceModule: sql`excluded.source_module`,
        descriptionTemplate: sql`excluded.description_template`,
        debitAccountCode: sql`excluded.debit_account_code`,
        creditAccountCode: sql`excluded.credit_account_code`,
        amountField: sql`excluded.amount_field`,
        isActive: sql`excluded.is_active`,
      },
    });

  console.log("✓ Reglas contables cargadas.");
}

runSeedRules()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit();
  });