import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import {
  banks,
  cashReceiptStatusEnum,
  clients,
  employees,
  employeeRequestStatusEnum,
  employeeRequests,
  factoringStatusEnum,
  orderItems,
  orders,
  paymentMethodEnum,
  quotations,
  taxZoneEnum,
} from "../schema";

// First extracted ERP block from the legacy schema.
export const preInvoices = pgTable("prefacturas", {
  id: uuid("id").defaultRandom().primaryKey(),
  prefacturaCode: varchar("prefactura_code", { length: 20 }).unique().notNull(),
  quotationId: uuid("quotation_id").references(() => quotations.id, {
    onDelete: "cascade",
  }),
  orderId: uuid("order_id").references(() => orders.id, {
    onDelete: "set null",
  }),
  status: varchar("status", { length: 40 })
    .default("PENDIENTE_CONTABILIDAD")
    .notNull(),
  totalProducts: numeric("total_products", { precision: 14, scale: 2 }).default(
    "0",
  ),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).default("0"),
  approvedAt: timestamp("approved_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  advanceRequired: numeric("advance_required", {
    precision: 14,
    scale: 2,
  }).default("0"),
  advanceReceived: numeric("advance_received", {
    precision: 14,
    scale: 2,
  }).default("0"),
  advanceStatus: varchar("advance_status", { length: 20 }).default("PENDIENTE"),
  advanceDate: timestamp("advance_date", { withTimezone: true }),
  advancePaymentImageUrl: text("advance_payment_image_url"),
  advanceMethod: varchar("advance_method", { length: 20 }),
  advanceBankId: uuid("advance_bank_id").references(() => banks.id),
  advanceReferenceNumber: varchar("advance_reference_number", { length: 120 }),
  advanceCurrency: varchar("advance_currency", { length: 10 }).default("COP"),
  hasConvenio: boolean("has_convenio").default(false),
  convenioType: varchar("convenio_type", { length: 80 }),
  convenioNotes: text("convenio_notes"),
  convenioExpiresAt: date("convenio_expires_at"),
  hasClientApproval: boolean("has_client_approval").default(false),
  clientApprovalDate: date("client_approval_date"),
  clientApprovalBy: varchar("client_approval_by", { length: 150 }),
  clientApprovalNotes: text("client_approval_notes"),
  clientApprovalImageUrl: text("client_approval_image_url"),
  convenioImageUrl: text("convenio_image_url"),
  municipalityFiscalSnapshot: varchar("municipality_fiscal_snapshot", {
    length: 100,
  }),
  taxZoneSnapshot: taxZoneEnum("tax_zone_snapshot"),
  clientPriceType: varchar("client_price_type", { length: 20 }),
  clientId: uuid("client_id").references(() => clients.id),
  paymentType: varchar("payment_type", { length: 20 }).default("CASH"),
  dueDate: date("due_date"),
  ivaRate: numeric("iva_rate", { precision: 5, scale: 2 }).default("19"),
  ivaAmount: numeric("iva_amount", { precision: 14, scale: 2 }).default("0"),
  withholdingTaxRate: numeric("withholding_tax_rate", {
    precision: 5,
    scale: 2,
  }).default("0"),
  withholdingIcaRate: numeric("withholding_ica_rate", {
    precision: 5,
    scale: 2,
  }).default("0"),
  withholdingIvaRate: numeric("withholding_iva_rate", {
    precision: 5,
    scale: 2,
  }).default("0"),
  withholdingTaxAmount: numeric("withholding_tax_amount", {
    precision: 14,
    scale: 2,
  }).default("0"),
  withholdingIcaAmount: numeric("withholding_ica_amount", {
    precision: 14,
    scale: 2,
  }).default("0"),
  withholdingIvaAmount: numeric("withholding_iva_amount", {
    precision: 14,
    scale: 2,
  }).default("0"),
  totalAfterWithholdings: numeric("total_after_withholdings", {
    precision: 14,
    scale: 2,
  }).default("0"),
  siigoStatus: varchar("siigo_status", { length: 20 }),
  siigoInvoiceId: varchar("siigo_invoice_id", { length: 80 }),
  siigoInvoiceNumber: varchar("siigo_invoice_number", { length: 80 }),
  siigoIssuedAt: timestamp("siigo_issued_at", { withTimezone: true }),
  siigoSentAt: timestamp("siigo_sent_at", { withTimezone: true }),
  siigoLastSyncAt: timestamp("siigo_last_sync_at", { withTimezone: true }),
  siigoErrorMessage: text("siigo_error_message"),
});

export const prefacturas = preInvoices;

// Second extracted ERP accounting block.
export const cashReceipts = pgTable("cash_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  receiptCode: varchar("receipt_code", { length: 20 }).unique().notNull(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  prefacturaId: uuid("prefactura_id").references(() => preInvoices.id),
  orderId: uuid("order_id").references(() => orders.id),
  receiptDate: date("receipt_date").notNull(),
  amountReceived: numeric("amount_received", {
    precision: 14,
    scale: 2,
  }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  includesIva: boolean("includes_iva").default(false),
  originBank: varchar("origin_bank", { length: 120 }),
  referenceNumber: varchar("reference_number", { length: 120 }),
  creditBalance: numeric("credit_balance", { precision: 14, scale: 2 }).default(
    "0",
  ),
  status: cashReceiptStatusEnum("status").default("PENDING"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const cashReceiptApplications = pgTable("cash_receipt_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  cashReceiptId: uuid("cash_receipt_id")
    .notNull()
    .references(() => cashReceipts.id, { onDelete: "cascade" }),
  prefacturaId: uuid("prefactura_id").references(() => preInvoices.id),
  appliedAmount: numeric("applied_amount", {
    precision: 14,
    scale: 2,
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const factoringRecords = pgTable("factoring_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  factoringCode: varchar("factoring_code", { length: 20 }).unique().notNull(),
  prefacturaId: uuid("prefactura_id")
    .notNull()
    .references(() => preInvoices.id),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  factoringEntity: varchar("factoring_entity", { length: 150 }).notNull(),
  assignmentDate: date("assignment_date").notNull(),
  discountRate: numeric("discount_rate", { precision: 5, scale: 2 }).notNull(),
  invoiceValue: numeric("invoice_value", { precision: 14, scale: 2 }).notNull(),
  netAmountReceived: numeric("net_amount_received", {
    precision: 14,
    scale: 2,
  }).notNull(),
  status: factoringStatusEnum("status").default("ACTIVE"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const colillaStatusEnum = pgEnum("colilla_status", [
  "BORRADOR",
  "LIQUIDADA",
  "PAGADA",
  "CONTABILIZADA",
]);

export const cartaLaboralTypeEnum = pgEnum("carta_laboral_type", [
  "LABORAL_GENERAL",
  "LABORAL_BANCO",
  "LABORAL_VISA",
  "INGRESO_SALARIO",
  "RETIRO",
  "PAZ_Y_SALVO",
]);

export const cartaLaboralStatusEnum = pgEnum("carta_laboral_status", [
  "EN_COLA",
  "GENERADA",
  "FIRMADA",
  "ENTREGADA",
]);

export const formacionTypeEnum = pgEnum("formacion_type", [
  "INDUCCION_OBLIGATORIA",
  "CAPACITACION",
  "ENTRENAMIENTO",
  "CURSO_EXTERNO",
  "REINDUCCION",
]);

export const formacionStatusEnum = pgEnum("formacion_status", [
  "INSCRITO",
  "EN_PROGRESO",
  "COMPLETADO",
  "REPROBADO",
  "CANCELADO",
]);

export const horaExtraTypeEnum = pgEnum("hora_extra_type", [
  "DIURNA_ORDINARIA",
  "NOCTURNA_ORDINARIA",
  "DOMINICAL_DIURNA",
  "DOMINICAL_NOCTURNA",
  "FESTIVO_DIURNO",
  "FESTIVO_NOCTURNO",
]);

export const certificado220StatusEnum = pgEnum("certificado_220_status", [
  "GENERADO",
  "FIRMADO",
  "ENTREGADO",
]);

export const hcmPreAsientoStatusEnum = pgEnum("hcm_pre_asiento_status", [
  "PENDIENTE",
  "APROBADO",
  "CONTABILIZADO",
  "RECHAZADO",
]);

export const colillasPago = pgTable(
  "colillas_pago",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    period: varchar("period", { length: 7 }).notNull(),
    status: colillaStatusEnum("status").notNull().default("BORRADOR"),
    salarioBasico: numeric("salario_basico", { precision: 14, scale: 2 }).notNull(),
    auxilioTransporte: numeric("auxilio_transporte", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),
    comisiones: numeric("comisiones", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    totalDevengado: numeric("total_devengado", { precision: 14, scale: 2 }).notNull(),
    saludEmpleado: numeric("salud_empleado", { precision: 12, scale: 2 }).notNull(),
    pensionEmpleado: numeric("pension_empleado", { precision: 12, scale: 2 }).notNull(),
    retencionFuente: numeric("retencion_fuente", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    totalDeducciones: numeric("total_deducciones", {
      precision: 14,
      scale: 2,
    }).notNull(),
    netoAPagar: numeric("neto_a_pagar", { precision: 14, scale: 2 }).notNull(),
    accountingEntryId: uuid("accounting_entry_id"),
    pdfUrl: text("pdf_url"),
    generadoPor: uuid("generado_por").references(() => employees.id),
    pagadoEn: timestamp("pagado_en", { withTimezone: true }),
    bankId: uuid("bank_id").references(() => banks.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    employeePeriodUnique: uniqueIndex("colillas_pago_employee_period_unique").on(
      table.employeeId,
      table.period,
    ),
    statusIdx: index("colillas_pago_status_idx").on(table.status),
  }),
);

export const certificados220 = pgTable(
  "certificados_220",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    vigenciaFiscal: integer("vigencia_fiscal").notNull(),
    totalIngresos: numeric("total_ingresos", { precision: 14, scale: 2 }).notNull(),
    totalRetenciones: numeric("total_retenciones", {
      precision: 12,
      scale: 2,
    }).notNull(),
    aportesSalud: numeric("aportes_salud", { precision: 12, scale: 2 }).notNull(),
    aportesPension: numeric("aportes_pension", { precision: 12, scale: 2 }).notNull(),
    status: certificado220StatusEnum("status").notNull().default("GENERADO"),
    pdfUrl: text("pdf_url"),
    firmadoPor: uuid("firmado_por").references(() => employees.id),
    firmadoEn: timestamp("firmado_en", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    employeeYearUnique: uniqueIndex("certificados_220_employee_year_unique").on(
      table.employeeId,
      table.vigenciaFiscal,
    ),
  }),
);

export const cartasLaborales = pgTable(
  "cartas_laborales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cartaCode: varchar("carta_code", { length: 30 }).notNull().unique(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    tipo: cartaLaboralTypeEnum("tipo").notNull(),
    destinatario: varchar("destinatario", { length: 255 }),
    proposito: text("proposito"),
    status: cartaLaboralStatusEnum("status").notNull().default("EN_COLA"),
    pdfUrl: text("pdf_url"),
    firmadaPor: uuid("firmada_por").references(() => employees.id),
    firmadaEn: timestamp("firmada_en", { withTimezone: true }),
    entregadaEn: timestamp("entregada_en", { withTimezone: true }),
    creadoEn: timestamp("creado_en", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    employeeStatusIdx: index("cartas_laborales_employee_status_idx").on(
      table.employeeId,
      table.status,
    ),
  }),
);

export const solicitudesHorasExtras = pgTable(
  "solicitudes_horas_extras",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    supervisorId: uuid("supervisor_id")
      .notNull()
      .references(() => employees.id),
    fecha: date("fecha").notNull(),
    horaInicio: varchar("hora_inicio", { length: 5 }).notNull(),
    horaFin: varchar("hora_fin", { length: 5 }).notNull(),
    tipo: horaExtraTypeEnum("tipo").notNull(),
    totalHoras: numeric("total_horas", { precision: 4, scale: 2 }).notNull(),
    actividad: text("actividad").notNull(),
    orderItemId: uuid("order_item_id").references(() => orderItems.id, {
      onDelete: "set null",
    }),
    employeeRequestId: uuid("employee_request_id").references(
      () => employeeRequests.id,
      {
        onDelete: "set null",
      },
    ),
    status: employeeRequestStatusEnum("status").notNull().default("PENDIENTE"),
    valorCalculado: numeric("valor_calculado", { precision: 12, scale: 2 }),
    period: varchar("period", { length: 7 }),
    aprobadoPor: uuid("aprobado_por").references(() => employees.id),
    aprobadoEn: timestamp("aprobado_en", { withTimezone: true }),
    rechazadoPor: uuid("rechazado_por").references(() => employees.id),
    motivoRechazo: text("motivo_rechazo"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    employeeStatusIdx: index("she_employee_status_idx").on(
      table.employeeId,
      table.status,
    ),
    periodIdx: index("she_period_idx").on(table.period),
    orderItemIdx: index("she_order_item_idx").on(table.orderItemId),
  }),
);

export const formaciones = pgTable(
  "formaciones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nombre: varchar("nombre", { length: 255 }).notNull(),
    tipo: formacionTypeEnum("tipo").notNull(),
    descripcion: text("descripcion"),
    instructor: varchar("instructor", { length: 255 }),
    modalidad: varchar("modalidad", { length: 20 }).notNull().default("PRESENCIAL"),
    duracionHoras: integer("duracion_horas").notNull(),
    fechaInicio: date("fecha_inicio").notNull(),
    fechaFin: date("fecha_fin"),
    obligatoria: boolean("obligatoria").notNull().default(false),
    certificaAlCompletar: boolean("certifica_al_completar").notNull().default(true),
    archivoUrl: text("archivo_url"),
    creadoPor: uuid("creado_por").references(() => employees.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    tipoObligatoriaIdx: index("formaciones_tipo_obligatoria_idx").on(
      table.tipo,
      table.obligatoria,
    ),
  }),
);

export const inscripcionesFormacion = pgTable(
  "inscripciones_formacion",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    formacionId: uuid("formacion_id")
      .notNull()
      .references(() => formaciones.id, { onDelete: "cascade" }),
    status: formacionStatusEnum("status").notNull().default("INSCRITO"),
    progresoPorcentaje: integer("progreso_porcentaje").notNull().default(0),
    calificacion: numeric("calificacion", { precision: 4, scale: 2 }),
    completadoEn: timestamp("completado_en", { withTimezone: true }),
    certificadoUrl: text("certificado_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    employeeFormacionUnique: uniqueIndex(
      "inscripciones_employee_formacion_unique",
    ).on(
      table.employeeId,
      table.formacionId,
    ),
  }),
);

export const hcmPreAsientos = pgTable(
  "hcm_pre_asientos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    origen: varchar("origen", { length: 40 }).notNull(),
    origenId: uuid("origen_id").notNull(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    period: varchar("period", { length: 7 }).notNull(),
    cuentaDebito: varchar("cuenta_debito", { length: 20 }).notNull(),
    cuentaCredito: varchar("cuenta_credito", { length: 20 }).notNull(),
    valor: numeric("valor", { precision: 14, scale: 2 }).notNull(),
    concepto: text("concepto").notNull(),
    status: hcmPreAsientoStatusEnum("status").notNull().default("PENDIENTE"),
    accountingEntryId: uuid("accounting_entry_id"),
    aprobadoPor: uuid("aprobado_por").references(() => employees.id),
    aprobadoEn: timestamp("aprobado_en", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    origenIdx: index("hcm_pre_asientos_origen_idx").on(table.origen, table.origenId),
    statusIdx: index("hcm_pre_asientos_status_idx").on(table.status),
    periodIdx: index("hcm_pre_asientos_period_idx").on(table.period),
  }),
);

export const notificacionesHcm = pgTable(
  "notificaciones_hcm",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    titulo: varchar("titulo", { length: 255 }).notNull(),
    mensaje: text("mensaje").notNull(),
    tipo: varchar("tipo", { length: 20 }).notNull().default("INFO"),
    leida: boolean("leida").notNull().default(false),
    accionUrl: text("accion_url"),
    creadaEn: timestamp("creada_en", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    employeeLeidaIdx: index("notificaciones_hcm_employee_leida_idx").on(
      table.employeeId,
      table.leida,
    ),
  }),
);

export {
  cashReceiptStatusEnum,
  factoringStatusEnum,
  paymentMethodEnum,
  taxZoneEnum,
} from "../schema";

export {
  employees,
  clients,
  clientLegalStatusHistory,
  categories,
  products,
  additions,
  quotations,
  quotationItems,
  quotationItemAdditions,
  orders,
  prioritySurchargeConfig,
  orderItems,
  orderItemPositions,
  orderItemTeams,
  orderItemAdditions,
  orderItemPackaging,
  orderItemSocks,
  orderItemSpecialRequirements,
  orderItemMaterials,
  orderItemIssues,
  orderItemRevisions,
  orderStatusHistory,
  orderItemStatusHistory,
  confectionists,
  orderItemConfection,
  suppliers,
  packers,
  orderItemPacker,
  messengers,
  inventoryCategories,
  warehouses,
  inventoryItems,
  inventoryItemVariants,
  warehouseStock,
  banks,
  purchaseRequirements,
  purchaseRequirementLines,
  siigoSyncJobs,
  purchaseOrders,
  purchaseOrderItems,
  purchaseOrderReceipts,
  purchaseOrderReceiptLines,
  purchaseOrderHistory,
  purchaseOrderRoutes,
  stockMovements,
  shipments,
  orderSupplies,
  orderPayments,
  bankReconciliations,
  bankReconciliationItems,
  taxZoneRates,
  payrollProvisions,
  pilaGenerations,
  employeeLeaves,
  employeeRequests,
  notifications,
  exchangeRates,
  advisorCommissionRates,
  legalStatusRecords,
  roles,
  permissions,
  rolePermissions,
  users,
  externalAccessOtps,
  fabrics,
  moldingTemplates,
  moldingTemplateFabrics,
  moldingTemplateInsumos,
  moldingTemplateInsumos as moldingTemplateSupplies,
  moldingTemplateSizeAdjustments,
  orderItemMoldings,
  orderItemMoldingInsumos,
  orderItemMoldingInsumos as orderItemMoldingSupplies,
  clientLegalStatus,
  pettyCashFunds,
  pettyCashTransactions,
  confectionistRates,
  packerRates,
  confectionistPaymentRequests,
  packerPaymentRequests,
  supplierInvoices,
  supplierPayments,
  supplierWithholdingRates,
} from "../schema";
