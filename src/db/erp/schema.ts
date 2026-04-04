import {
  boolean,
  date,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  banks,
  cashReceiptStatusEnum,
  clients,
  employees,
  factoringStatusEnum,
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
  moldingTemplates,
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
} from "../schema";
