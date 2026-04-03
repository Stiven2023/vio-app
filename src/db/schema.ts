// Re-export all enums from centralized enum file
export {
  PurchaseOrderStatus,
  PurchaseOrderStatusEnum,
  PurchaseOrderRouteType,
  PurchaseOrderRouteTypeEnum,
  PurchaseOrderPartyType,
  PurchaseOrderPartyTypeEnum,
  PurchaseOrderRouteStatus,
  PurchaseOrderRouteStatusEnum,
  ClientType,
  ClientTypeEnum,
  IdentificationType,
  IdentificationTypeEnum,
  TaxRegime,
  TaxRegimeEnum,
  ClientStatus,
  ClientStatusEnum,
  ClientPriceType,
  ClientPriceTypeEnum,
  ThirdPartyType,
  ThirdPartyTypeEnum,
  LegalStatus,
  LegalStatusEnum,
  DocumentType,
  DocumentTypeEnum,
  TaxZone,
  TaxZoneEnum,
  PaymentType,
  PaymentTypeEnum,
  CreditBackingType,
  CreditBackingTypeEnum,
  CashReceiptStatus,
  CashReceiptStatusEnum,
  ReconciliationItemType,
  ReconciliationItemTypeEnum,
  FactoringStatus,
  FactoringStatusEnum,
  AccountingAccountType,
  AccountingAccountTypeEnum,
  AccountingNormalBalance,
  AccountingNormalBalanceEnum,
  AccountingPeriodStatus,
  AccountingPeriodStatusEnum,
  AccountingEntryStatus,
  AccountingEntryStatusEnum,
  AccountingSourceModule,
  AccountingSourceModuleEnum,
  ContractType,
  ContractTypeEnum,
  LeaveType,
  LeaveTypeEnum,
  EmployeeRequestType,
  EmployeeRequestTypeEnum,
  EmployeeRequestStatus,
  EmployeeRequestStatusEnum,
  EmployeeRequestPriority,
  EmployeeRequestPriorityEnum,
  Role,
  RoleEnum,
  Permission,
  PermissionEnum,
  OrderType,
  OrderTypeEnum,
  OrderKind,
  OrderKindEnum,
  OrderStatus,
  OrderStatusEnum,
  OrderItemStatus,
  OrderItemStatusEnum,
  DesignType,
  DesignTypeEnum,
  ProductionTechnique,
  ProductionTechniqueEnum,
  Position,
  PositionEnum,
  SockLength,
  SockLengthEnum,
  PaymentMethod,
  PaymentMethodEnum,
  PaymentStatus,
  PaymentStatusEnum,
  InventoryLocation,
  InventoryLocationEnum,
  InventoryCategoryType,
  InventoryCategoryTypeEnum,
  WarehousePurpose,
  WarehousePurposeEnum,
  WarehouseTransferStatus,
  WarehouseTransferStatusEnum,
  StockMovementType,
  StockMovementTypeEnum,
  StockMovementReason,
  StockMovementReasonEnum,
  StockMovementReferenceType,
  StockMovementReferenceTypeEnum,
  ShipmentMode,
  ShipmentModeEnum,
  ShipmentPaymentStatus,
  ShipmentPaymentStatusEnum,
  ShipmentDocumentType,
  ShipmentDocumentTypeEnum,
  ShipmentDocumentRef,
  ShipmentDocumentRefEnum,
  ShipmentEmailMode,
  ShipmentEmailModeEnum,
  MoldingInsumoStatus,
  MoldingInsumoStatusEnum,
  MesPriority,
  MesPriorityEnum,
  MesQueueStatus,
  MesQueueStatusEnum,
  MesAssignmentStatus,
  MesAssignmentStatusEnum,
  MesRepoItemType,
  MesRepoItemTypeEnum,
  MesRepoReason,
  MesRepoReasonEnum,
  // Export value arrays
  purchaseOrderStatusValues,
  purchaseOrderRouteTypeValues,
  purchaseOrderPartyTypeValues,
  purchaseOrderRouteStatusValues,
  clientTypeValues,
  identificationTypeValues,
  taxRegimeValues,
  clientStatusValues,
  clientPriceTypeValues,
  thirdPartyTypeValues,
  legalStatusValues,
  documentTypeValues,
  taxZoneValues,
  paymentTypeValues,
  creditBackingTypeValues,
  cashReceiptStatusValues,
  reconciliationItemTypeValues,
  factoringStatusValues,
  accountingAccountTypeValues,
  accountingNormalBalanceValues,
  accountingPeriodStatusValues,
  accountingEntryStatusValues,
  accountingSourceModuleValues,
  contractTypeValues,
  leaveTypeValues,
  employeeRequestTypeValues,
  employeeRequestStatusValues,
  employeeRequestPriorityValues,
  roleValues,
  permissionValues,
  orderTypeValues,
  orderKindValues,
  orderStatusValues,
  orderItemStatusValues,
  designTypeValues,
  productionTechniqueValues,
  positionValues,
  sockLengthValues,
  paymentMethodValues,
  paymentStatusValues,
  inventoryLocationValues,
  inventoryCategoryTypeValues,
  warehousePurposeValues,
  warehouseTransferStatusValues,
  stockMovementTypeValues,
  stockMovementReasonValues,
  stockMovementReferenceTypeValues,
  shipmentModeValues,
  shipmentPaymentStatusValues,
  shipmentDocumentTypeValues,
  shipmentDocumentRefValues,
  shipmentEmailModeValues,
  moldingInsumoStatusValues,
  mesPriorityValues,
  mesQueueStatusValues,
  mesAssignmentStatusValues,
  mesRepoItemTypeValues,
  mesRepoReasonValues,
  pettyCashTransactionTypeValues,
  pettyCashFundStatusValues,
  mesItemTagValues,
  mesShipmentAreaValues,
  mesTransportTypeValues,
  mesEnvioStatusValues,
} from "./enums";

import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  uniqueIndex,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  purchaseOrderStatusValues,
  purchaseOrderRouteTypeValues,
  purchaseOrderPartyTypeValues,
  purchaseOrderRouteStatusValues,
  clientTypeValues,
  identificationTypeValues,
  taxRegimeValues,
  clientStatusValues,
  clientPriceTypeValues,
  thirdPartyTypeValues,
  legalStatusValues,
  documentTypeValues,
  taxZoneValues,
  paymentTypeValues,
  creditBackingTypeValues,
  cashReceiptStatusValues,
  reconciliationItemTypeValues,
  factoringStatusValues,
  accountingAccountTypeValues,
  accountingNormalBalanceValues,
  accountingPeriodStatusValues,
  accountingEntryStatusValues,
  accountingSourceModuleValues,
  contractTypeValues,
  leaveTypeValues,
  employeeRequestTypeValues,
  employeeRequestStatusValues,
  employeeRequestPriorityValues,
  orderTypeValues,
  orderKindValues,
  orderStatusValues,
  orderItemStatusValues,
  designTypeValues,
  productionTechniqueValues,
  positionValues,
  sockLengthValues,
  paymentMethodValues,
  paymentStatusValues,
  inventoryLocationValues,
  inventoryCategoryTypeValues,
  warehousePurposeValues,
  warehouseTransferStatusValues,
  stockMovementTypeValues,
  stockMovementReasonValues,
  stockMovementReferenceTypeValues,
  shipmentModeValues,
  shipmentPaymentStatusValues,
  shipmentDocumentTypeValues,
  shipmentDocumentRefValues,
  shipmentEmailModeValues,
  moldingInsumoStatusValues,
  mesPriorityValues,
  mesQueueStatusValues,
  mesAssignmentStatusValues,
  mesRepoItemTypeValues,
  mesRepoReasonValues,
  pettyCashTransactionTypeValues,
  pettyCashFundStatusValues,
  mesItemTagValues,
  mesShipmentAreaValues,
  mesTransportTypeValues,
  mesEnvioStatusValues,
} from "./enums";

/* ========================= */
/* Create pgEnum from values */
/* ========================= */

export const purchaseOrderStatusPgEnum = pgEnum(
  "purchase_order_status",
  purchaseOrderStatusValues,
);
export const purchaseOrderRouteTypePgEnum = pgEnum(
  "purchase_order_route_type",
  purchaseOrderRouteTypeValues,
);
export const purchaseOrderPartyTypePgEnum = pgEnum(
  "purchase_order_party_type",
  purchaseOrderPartyTypeValues,
);
export const purchaseOrderRouteStatusPgEnum = pgEnum(
  "purchase_order_route_status",
  purchaseOrderRouteStatusValues,
);
export const clientTypePgEnum = pgEnum("client_type", clientTypeValues);
export const identificationTypePgEnum = pgEnum(
  "identification_type",
  identificationTypeValues,
);
export const taxRegimePgEnum = pgEnum("tax_regime", taxRegimeValues);
export const clientStatusPgEnum = pgEnum("client_status", clientStatusValues);
export const clientPriceTypePgEnum = pgEnum(
  "client_price_type",
  clientPriceTypeValues,
);
export const thirdPartyTypePgEnum = pgEnum(
  "third_party_type",
  thirdPartyTypeValues,
);
export const legalStatusPgEnum = pgEnum(
  "legal_status_status",
  legalStatusValues,
);
export const documentTypePgEnum = pgEnum("document_type", documentTypeValues);
export const taxZonePgEnum = pgEnum("tax_zone", taxZoneValues);
export const paymentTypePgEnum = pgEnum("payment_type", paymentTypeValues);
export const creditBackingTypePgEnum = pgEnum(
  "credit_backing_type",
  creditBackingTypeValues,
);
export const cashReceiptStatusPgEnum = pgEnum(
  "cash_receipt_status",
  cashReceiptStatusValues,
);
export const reconciliationItemTypePgEnum = pgEnum(
  "reconciliation_item_type",
  reconciliationItemTypeValues,
);
export const factoringStatusPgEnum = pgEnum(
  "factoring_status",
  factoringStatusValues,
);
export const accountingAccountTypePgEnum = pgEnum(
  "accounting_account_type",
  accountingAccountTypeValues,
);
export const accountingNormalBalancePgEnum = pgEnum(
  "accounting_normal_balance",
  accountingNormalBalanceValues,
);
export const accountingPeriodStatusPgEnum = pgEnum(
  "accounting_period_status",
  accountingPeriodStatusValues,
);
export const accountingEntryStatusPgEnum = pgEnum(
  "accounting_entry_status",
  accountingEntryStatusValues,
);
export const accountingSourceModulePgEnum = pgEnum(
  "accounting_source_module",
  accountingSourceModuleValues,
);
export const contractTypePgEnum = pgEnum("contract_type", contractTypeValues);
export const leaveTypePgEnum = pgEnum("leave_type", leaveTypeValues);
export const employeeRequestTypePgEnum = pgEnum(
  "employee_request_type",
  employeeRequestTypeValues,
);
export const employeeRequestStatusPgEnum = pgEnum(
  "employee_request_status",
  employeeRequestStatusValues,
);
export const employeeRequestPriorityPgEnum = pgEnum(
  "employee_request_priority",
  employeeRequestPriorityValues,
);
export const orderTypePgEnum = pgEnum("order_type", orderTypeValues);
export const orderKindPgEnum = pgEnum("order_kind", orderKindValues);
export const orderStatusPgEnum = pgEnum("order_status", orderStatusValues);
export const orderItemStatusPgEnum = pgEnum(
  "order_item_status",
  orderItemStatusValues,
);
export const designTypePgEnum = pgEnum("design_type", designTypeValues);
export const productionTechniquePgEnum = pgEnum(
  "production_technique",
  productionTechniqueValues,
);
export const positionPgEnum = pgEnum("position", positionValues);
export const sockLengthPgEnum = pgEnum("sock_length", sockLengthValues);
export const paymentMethodPgEnum = pgEnum(
  "payment_method",
  paymentMethodValues,
);
export const paymentStatusPgEnum = pgEnum(
  "payment_status",
  paymentStatusValues,
);
export const inventoryLocationPgEnum = pgEnum(
  "inventory_location",
  inventoryLocationValues,
);
export const inventoryCategoryTypePgEnum = pgEnum(
  "inventory_category_type",
  inventoryCategoryTypeValues,
);
export const warehousePurposePgEnum = pgEnum(
  "warehouse_purpose",
  warehousePurposeValues,
);
export const warehouseTransferStatusPgEnum = pgEnum(
  "warehouse_transfer_status",
  warehouseTransferStatusValues,
);
export const stockMovementTypePgEnum = pgEnum(
  "stock_movement_type",
  stockMovementTypeValues,
);
export const stockMovementReasonPgEnum = pgEnum(
  "stock_movement_reason",
  stockMovementReasonValues,
);
export const stockMovementReferenceTypePgEnum = pgEnum(
  "stock_movement_reference_type",
  stockMovementReferenceTypeValues,
);
export const shipmentModePgEnum = pgEnum("shipment_mode", shipmentModeValues);
export const shipmentPaymentStatusPgEnum = pgEnum(
  "shipment_payment_status",
  shipmentPaymentStatusValues,
);
export const shipmentDocumentTypePgEnum = pgEnum(
  "shipment_document_type",
  shipmentDocumentTypeValues,
);
export const shipmentDocumentRefPgEnum = pgEnum(
  "shipment_document_ref",
  shipmentDocumentRefValues,
);
export const shipmentEmailModePgEnum = pgEnum(
  "shipment_email_mode",
  shipmentEmailModeValues,
);
export const moldingInsumoStatusPgEnum = pgEnum(
  "molding_insumo_status",
  moldingInsumoStatusValues,
);
export const mesPriorityPgEnum = pgEnum("mes_priority", mesPriorityValues);
export const mesQueueStatusPgEnum = pgEnum(
  "mes_queue_status",
  mesQueueStatusValues,
);
export const mesAssignmentStatusPgEnum = pgEnum(
  "mes_assignment_status",
  mesAssignmentStatusValues,
);
export const mesRepoItemTypePgEnum = pgEnum(
  "mes_repo_item_type",
  mesRepoItemTypeValues,
);
export const mesRepoReasonPgEnum = pgEnum(
  "mes_repo_reason",
  mesRepoReasonValues,
);
export const pettyCashTransactionTypePgEnum = pgEnum(
  "petty_cash_transaction_type",
  pettyCashTransactionTypeValues,
);
export const pettyCashFundStatusPgEnum = pgEnum(
  "petty_cash_fund_status",
  pettyCashFundStatusValues,
);
export const mesItemTagPgEnum = pgEnum("mes_item_tag", mesItemTagValues);
export const mesShipmentAreaPgEnum = pgEnum(
  "mes_shipment_area",
  mesShipmentAreaValues,
);
export const mesTransportTypePgEnum = pgEnum(
  "mes_transport_type",
  mesTransportTypeValues,
);
export const mesEnvioStatusPgEnum = pgEnum(
  "mes_envio_status",
  mesEnvioStatusValues,
);

/* Backward compatibility aliases for schema column definitions */
export const purchaseOrderStatusEnum = purchaseOrderStatusPgEnum;
export const purchaseOrderRouteTypeEnum = purchaseOrderRouteTypePgEnum;
export const purchaseOrderPartyTypeEnum = purchaseOrderPartyTypePgEnum;
export const purchaseOrderRouteStatusEnum = purchaseOrderRouteStatusPgEnum;
export const clientTypeEnum = clientTypePgEnum;
export const identificationTypeEnum = identificationTypePgEnum;
export const taxRegimeEnum = taxRegimePgEnum;
export const clientStatusEnum = clientStatusPgEnum;
export const clientPriceTypeEnum = clientPriceTypePgEnum;
export const thirdPartyTypeEnum = thirdPartyTypePgEnum;
export const legalStatusEnum = legalStatusPgEnum;
export const documentTypeEnum = documentTypePgEnum;
export const taxZoneEnum = taxZonePgEnum;
export const paymentTypeEnum = paymentTypePgEnum;
export const creditBackingTypeEnum = creditBackingTypePgEnum;
export const cashReceiptStatusEnum = cashReceiptStatusPgEnum;
export const reconciliationItemTypeEnum = reconciliationItemTypePgEnum;
export const factoringStatusEnum = factoringStatusPgEnum;
export const accountingAccountTypeEnum = accountingAccountTypePgEnum;
export const accountingNormalBalanceEnum = accountingNormalBalancePgEnum;
export const accountingPeriodStatusEnum = accountingPeriodStatusPgEnum;
export const accountingEntryStatusEnum = accountingEntryStatusPgEnum;
export const accountingSourceModuleEnum = accountingSourceModulePgEnum;
export const contractTypeEnum = contractTypePgEnum;
export const leaveTypeEnum = leaveTypePgEnum;
export const employeeRequestTypeEnum = employeeRequestTypePgEnum;
export const employeeRequestStatusEnum = employeeRequestStatusPgEnum;
export const employeeRequestPriorityEnum = employeeRequestPriorityPgEnum;
export const orderTypeEnum = orderTypePgEnum;
export const orderKindEnum = orderKindPgEnum;
export const orderStatusEnum = orderStatusPgEnum;
export const orderItemStatusEnum = orderItemStatusPgEnum;
export const designTypeEnum = designTypePgEnum;
export const productionTechniqueEnum = productionTechniquePgEnum;
export const positionEnum = positionPgEnum;
export const sockLengthEnum = sockLengthPgEnum;
export const paymentMethodEnum = paymentMethodPgEnum;
export const paymentStatusEnum = paymentStatusPgEnum;
export const inventoryLocationEnum = inventoryLocationPgEnum;
export const inventoryCategoryTypeEnum = inventoryCategoryTypePgEnum;
export const warehousePurposeEnum = warehousePurposePgEnum;
export const warehouseTransferStatusEnum = warehouseTransferStatusPgEnum;
export const stockMovementTypeEnum = stockMovementTypePgEnum;
export const stockMovementReasonEnum = stockMovementReasonPgEnum;
export const stockMovementReferenceTypeEnum = stockMovementReferenceTypePgEnum;
export const shipmentModeEnum = shipmentModePgEnum;
export const shipmentPaymentStatusEnum = shipmentPaymentStatusPgEnum;
export const shipmentDocumentTypeEnum = shipmentDocumentTypePgEnum;
export const shipmentDocumentRefEnum = shipmentDocumentRefPgEnum;
export const shipmentEmailModeEnum = shipmentEmailModePgEnum;
export const moldingInsumoStatusEnum = moldingInsumoStatusPgEnum;
export const mesPriorityEnum = mesPriorityPgEnum;
export const mesQueueStatusEnum = mesQueueStatusPgEnum;
export const mesAssignmentStatusEnum = mesAssignmentStatusPgEnum;
export const mesRepoItemTypeEnum = mesRepoItemTypePgEnum;
export const mesRepoReasonEnum = mesRepoReasonPgEnum;
export const pettyCashTransactionTypeEnum = pettyCashTransactionTypePgEnum;
export const pettyCashFundStatusEnum = pettyCashFundStatusPgEnum;
export const mesItemTagEnum = mesItemTagPgEnum;
export const mesShipmentAreaEnum = mesShipmentAreaPgEnum;
export const mesTransportTypeEnum = mesTransportTypePgEnum;
export const mesEnvioStatusEnum = mesEnvioStatusPgEnum;

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 64 }).unique(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  preferredLanguage: varchar("preferred_language", { length: 10 }).default(
    "es",
  ),
  emailVerified: boolean("email_verified").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  token: varchar("token", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  token: varchar("token", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const externalAccessOtps = pgTable("external_access_otps", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  clientCode: varchar("client_code", { length: 20 }).notNull(),
  audience: varchar("audience", { length: 20 }).notNull(),
  token: varchar("token", { length: 10 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  resendAvailableAt: timestamp("resend_available_at", {
    withTimezone: true,
  }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   ROLES & PERMISSIONS
========================= */
export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).unique().notNull(),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 150 }).unique().notNull(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
  }),
);

/* =========================
   EMPLOYEES (Ajustado)
========================= */
export const employees = pgTable(
  "employees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // External reference to IAM users.id (no cross-database FK)
    userId: uuid("user_id"),

    // --- CÓDIGO AUTOGENERADO ---
    employeeCode: varchar("employee_code", { length: 20 }).unique().notNull(),

    // --- DOCUMENTOS (Igual que clientes) ---
    identityDocumentUrl: varchar("identity_document_url", { length: 500 }), // Cédula (CC) / CE
    rutDocumentUrl: varchar("rut_document_url", { length: 500 }), // RUT
    commerceChamberDocumentUrl: varchar("commerce_chamber_document_url", {
      length: 500,
    }), // Cámara de comercio
    passportDocumentUrl: varchar("passport_document_url", { length: 500 }), // Pasaporte
    taxCertificateDocumentUrl: varchar("tax_certificate_document_url", {
      length: 500,
    }), // Certificado tributario
    companyIdDocumentUrl: varchar("company_id_document_url", { length: 500 }), // ID de empresa

    // --- DOCUMENTOS DEL EMPLEADO ---
    hojaDeVidaUrl: varchar("hoja_de_vida_url", { length: 500 }),
    certificadoLaboralUrl: varchar("certificado_laboral_url", { length: 500 }),
    certificadoEstudiosUrl: varchar("certificado_estudios_url", {
      length: 500,
    }),
    epsCertificateUrl: varchar("eps_certificate_url", { length: 500 }),
    pensionCertificateUrl: varchar("pension_certificate_url", { length: 500 }),
    bankCertificateUrl: varchar("bank_certificate_url", { length: 500 }),
    employeeImageUrl: varchar("employee_image_url", { length: 500 }),
    signatureImageUrl: varchar("signature_image_url", { length: 500 }),
    companyImageUrl: varchar("company_image_url", { length: 500 }),

    // --- IDENTIFICACIÓN Y NOMBRE ---
    name: varchar("name", { length: 255 }).notNull(),
    identificationType: identificationTypeEnum("identification_type").notNull(),
    identification: varchar("identification", { length: 20 })
      .unique()
      .notNull(),
    dv: varchar("dv", { length: 1 }),

    // --- CONTACTO DETALLADO ---
    email: varchar("email", { length: 255 }).notNull(),
    intlDialCode: varchar("intl_dial_code", { length: 5 }).default("57"),
    mobile: varchar("mobile", { length: 20 }),
    fullMobile: varchar("full_mobile", { length: 25 }),
    landline: varchar("landline", { length: 20 }),
    extension: varchar("extension", { length: 10 }),

    // --- UBICACIÓN ---
    address: varchar("address", { length: 255 }),
    city: varchar("city", { length: 100 }).default("Medellín"),
    department: varchar("department", { length: 100 }).default("ANTIOQUIA"),

    // --- ROL Y ESTADO ---
    roleId: uuid("role_id").references(() => roles.id),
    contractType: contractTypeEnum("contract_type"),
    isActive: boolean("is_active").default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_employees_user_id").on(t.userId)],
);

/* =========================
   CLIENTS
========================= */
export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),

  // --- CÓDIGO DE CLIENTE AUTOMÁTICO ---
  clientCode: varchar("client_code", { length: 20 }).unique().notNull(), // "CN10001", "CE10001", "EM10001"
  clientType: clientTypeEnum("client_type").notNull(), // NACIONAL, EXTRANJERO, EMPLEADO

  // --- DOCUMENTOS ---
  // El tipo de persona se deduce del identificationType:
  // CC → Persona Natural Nacional
  // NIT → Empresa Nacional
  // CE → Persona Natural Extranjera
  // PAS → Persona Natural Extranjera (Venezolano)
  // EMPRESA_EXTERIOR → Empresa Extranjera

  identityDocumentUrl: varchar("identity_document_url", { length: 500 }), // Cédula (CC) / CE / Cédula rep. legal (NIT)
  rutDocumentUrl: varchar("rut_document_url", { length: 500 }), // RUT (CC, NIT)
  commerceChamberDocumentUrl: varchar("commerce_chamber_document_url", {
    length: 500,
  }), // Cámara de Comercio (NIT)
  passportDocumentUrl: varchar("passport_document_url", { length: 500 }), // Pasaporte/PPT (CE, PAS, EMPRESA_EXTERIOR)
  taxCertificateDocumentUrl: varchar("tax_certificate_document_url", {
    length: 500,
  }), // Certificado tributario (EMPRESA_EXTERIOR)
  companyIdDocumentUrl: varchar("company_id_document_url", { length: 500 }), // ID de empresa (EMPRESA_EXTERIOR)

  // --- IDENTIFICACIÓN Y NOMBRE (Imagen 1 y 2) ---
  name: varchar("name", { length: 255 }).notNull(), // "Nombre tercero"
  identificationType: identificationTypeEnum("identification_type").notNull(), // CC, NIT, CE, PAS, EMPRESA_EXTERIOR
  identification: varchar("identification", { length: 20 }).unique().notNull(), // "Identificación"
  dv: varchar("dv", { length: 1 }), // "Digito verificación"
  branch: varchar("branch", { length: 10 }).default("01"), // "Sucursal"

  // --- INFORMACIÓN FISCAL Y CONTACTO ---
  taxRegime: taxRegimeEnum("tax_regime").notNull(), // REGIMEN_COMUN, REGIMEN_SIMPLIFICADO, NO_RESPONSABLE
  contactName: varchar("contact_name", { length: 255 }).notNull(), // "NOMBRE DE CONTACTO"
  email: varchar("email", { length: 255 }).notNull(), // "CORREO" (Crítico para facturación)

  // --- UBICACIÓN GEOGRÁFICA (Imagen 2: Medellín, Antioquia, 5001) ---
  address: varchar("address", { length: 255 }).notNull(), // "Dirección"
  postalCode: varchar("postal_code", { length: 20 }), // "CODIGO POSTAL"
  country: varchar("country", { length: 100 }).default("COLOMBIA"), // "Pais"
  department: varchar("department", { length: 100 }).default("ANTIOQUIA"), // "Departamento"
  city: varchar("city", { length: 100 }).default("Medellín"), // "Ciudad"

  // --- TELÉFONOS Y MARCACIÓN (Estructura compleja de Imagen 1) ---
  intlDialCode: varchar("intl_dial_code", { length: 5 }).default("57"), // "CÓDIGO DE MARCACIÓN INTERNACIONAL"
  mobile: varchar("mobile", { length: 20 }), // "MOVIL"
  fullMobile: varchar("full_mobile", { length: 25 }), // "CÓDIGO DE MARCACIÓN + MOVIL" (Calculado)
  localDialCode: varchar("local_dial_code", { length: 5 }), // "CÓDIGO DE MARCACIÓN LOCAL"
  landline: varchar("landline", { length: 20 }), // "FIJO"
  extension: varchar("extension", { length: 10 }), // "EXT"
  fullLandline: varchar("full_landline", { length: 30 }), // "CÓDIGO DE MARCACIÓN + fijo + EXT"

  // --- ESTADO Y CRÉDITO ---
  status: clientStatusEnum("status").default("ACTIVO"), // ACTIVO, INACTIVO, SUSPENDIDO
  creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }), // Monto tope de crédito (solo si hasCredit)
  isActive: boolean("is_active").default(true), // "Estado" (mantener por compatibilidad)
  hasCredit: boolean("has_credit").default(false), // "CREDITO"
  municipalityFiscal: varchar("municipality_fiscal", { length: 100 }),
  taxZone: taxZoneEnum("tax_zone").default("CONTINENTAL"),
  paymentType: paymentTypeEnum("payment_type").default("CASH"),
  creditBackingType: creditBackingTypeEnum("credit_backing_type"),
  promissoryNoteNumber: varchar("promissory_note_number", { length: 50 }), // "NUMERO PAGARE"
  promissoryNoteDate: date("promissory_note_date"), // "FECHA FIRMA PAGARE"

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   ESTADO JURÍDICO DE CLIENTES
========================= */

export const clientLegalStatusHistory = pgTable("client_legal_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  clientName: varchar("client_name", { length: 255 }).notNull(), // Denormalizado para búsqueda
  status: legalStatusEnum("status").notNull(), // VIGENTE, EN_REVISION, BLOQUEADO
  notes: text("notes"), // Notas/observaciones del estado
  reviewedBy: varchar("reviewed_by", { length: 255 }), // Usuario que realizó la revisión
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow(), // Fecha de la revisión
  changedFields: text("changed_fields"), // Campos modificados (JSON serializado) cuando es cambio automático
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   PRODUCTOS + CATEGORÍAS + PRECIOS
========================= */

export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 150 }).unique().notNull(),
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  productCode: varchar("product_code", { length: 10 }).unique().notNull(),
  productKind: varchar("product_kind", { length: 20 })
    .default("REGULAR")
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  categoryId: uuid("category_id").references(() => categories.id),
  priceCopBase: numeric("price_cop_base", { precision: 14, scale: 2 }),
  priceCopInternational: numeric("price_cop_international", {
    precision: 14,
    scale: 2,
  }),
  priceCopR1: numeric("price_cop_r1", { precision: 14, scale: 2 }),
  priceCopR2: numeric("price_cop_r2", { precision: 14, scale: 2 }),
  priceCopR3: numeric("price_cop_r3", { precision: 14, scale: 2 }),
  priceViomar: numeric("price_viomar", { precision: 14, scale: 2 }),
  priceColanta: numeric("price_colanta", { precision: 14, scale: 2 }),
  priceMayorista: numeric("price_mayorista", { precision: 14, scale: 2 }),
  priceUSD: numeric("price_usd", { precision: 14, scale: 2 }),
  trmUsed: numeric("trm_used", { precision: 14, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  // SIIGO sync tracking
  siigoId: varchar("siigo_id", { length: 100 }),
  siigoSynced: boolean("siigo_synced").default(false).notNull(),
  siigoSyncedAt: timestamp("siigo_synced_at", { withTimezone: true }),
  siigoSyncError: text("siigo_sync_error"),
});

export const additions = pgTable("additions", {
  id: uuid("id").defaultRandom().primaryKey(),
  additionCode: varchar("addition_code", { length: 10 }).unique().notNull(),
  catalogType: varchar("catalog_type", { length: 20 })
    .default("NACIONAL")
    .notNull(),
  productKind: varchar("product_kind", { length: 20 })
    .default("REGULAR")
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  categoryId: uuid("category_id").references(() => categories.id),
  // Precios integrados
  priceCopBase: numeric("price_cop_base", { precision: 14, scale: 2 }),
  priceCopInternational: numeric("price_cop_international", {
    precision: 14,
    scale: 2,
  }),
  priceUSD: numeric("price_usd", { precision: 14, scale: 2 }),
  trmUsed: numeric("trm_used", { precision: 14, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const quotations = pgTable("quotations", {
  id: uuid("id").defaultRandom().primaryKey(),
  quoteCode: varchar("quote_code", { length: 20 }).unique().notNull(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  sellerId: uuid("seller_id")
    .notNull()
    .references(() => users.id),
  clientPriceType: varchar("client_price_type", { length: 20 }),
  documentType: documentTypeEnum("document_type").default("F").notNull(), // F = Factura, R = Razón social
  currency: varchar("currency", { length: 5 }).default("COP").notNull(),
  deliveryDate: date("delivery_date"),
  expiryDate: date("expiry_date"),
  paymentTerms: varchar("payment_terms", { length: 120 }),
  promissoryNoteNumber: varchar("promissory_note_number", { length: 50 }), // Solo si paymentTerms es CREDITO
  totalProducts: numeric("total_products", { precision: 14, scale: 2 }).default(
    "0",
  ),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).default("0"),
  iva: numeric("iva", { precision: 14, scale: 2 }).default("0"),
  shippingEnabled: boolean("shipping_enabled").default(false),
  shippingFee: numeric("shipping_fee", { precision: 14, scale: 2 }).default(
    "0",
  ),
  insuranceEnabled: boolean("insurance_enabled").default(false),
  insuranceFee: numeric("insurance_fee", { precision: 14, scale: 2 }).default(
    "0",
  ),
  total: numeric("total", { precision: 14, scale: 2 }).default("0"),
  advancePayment: numeric("advance_payment", {
    precision: 14,
    scale: 2,
  }).default("0"),
  municipalityFiscalSnapshot: varchar("municipality_fiscal_snapshot", {
    length: 100,
  }),
  taxZoneSnapshot: taxZoneEnum("tax_zone_snapshot"),
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
  prefacturaApproved: boolean("prefactura_approved").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const quotationItems = pgTable("quotation_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  quotationId: uuid("quotation_id")
    .notNull()
    .references(() => quotations.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  orderType: varchar("order_type", { length: 20 }).notNull(),
  negotiation: varchar("negotiation", { length: 20 }),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 14, scale: 2 }).default("0"),
  orderCodeReference: varchar("order_code_reference", { length: 20 }),
  designNumber: varchar("design_number", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const quotationItemAdditions = pgTable("quotation_item_additions", {
  id: uuid("id").defaultRandom().primaryKey(),
  quotationItemId: uuid("quotation_item_id")
    .notNull()
    .references(() => quotationItems.id, { onDelete: "cascade" }),
  additionId: uuid("addition_id")
    .notNull()
    .references(() => additions.id),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   ORDERS
========================= */
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderCode: varchar("order_code", { length: 20 }).unique().notNull(),
  orderName: varchar("order_name", { length: 255 }),
  clientId: uuid("client_id").references(() => clients.id),
  type: orderTypeEnum("type").notNull(),
  kind: orderKindEnum("kind").default("NUEVO"),
  sourceOrderId: uuid("source_order_id"),
  status: orderStatusEnum("status").notNull(),
  deliveryDate: date("delivery_date"),
  total: numeric("total", { precision: 14, scale: 2 }).default("0"),
  ivaEnabled: boolean("iva_enabled").default(false),
  discount: numeric("discount", { precision: 14, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 5 }).default("COP"),
  shippingFee: numeric("shipping_fee", { precision: 14, scale: 2 }).default(
    "0",
  ),
  createdBy: uuid("created_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  // Provisional code (set by asesor at creation; official orderCode assigned at aval)
  provisionalCode: varchar("provisional_code", { length: 60 }),
  dispatchBlockedByLegal: boolean("dispatch_blocked_by_legal").default(false),
  dispatchBlockOverridden: boolean("dispatch_block_overridden").default(false),
  dispatchBlockOverrideReason: text("dispatch_block_override_reason"),
  progressPercentage: numeric("progress_percentage", {
    precision: 5,
    scale: 2,
  }).default("0"),
  // Operational approval (aval)
  operationalApprovedAt: timestamp("operational_approved_at", {
    withTimezone: true,
  }),
  operationalApprovedBy: uuid("operational_approved_by").references(
    () => employees.id,
  ),
});

export const prefacturas = pgTable("prefacturas", {
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
  // Advance payment (anticipo)
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
  // Advance payment method
  advanceMethod: varchar("advance_method", { length: 20 }),
  advanceBankId: uuid("advance_bank_id").references(() => banks.id),
  advanceReferenceNumber: varchar("advance_reference_number", { length: 120 }),
  advanceCurrency: varchar("advance_currency", { length: 10 }).default("COP"),
  // Convenio comercial
  hasConvenio: boolean("has_convenio").default(false),
  convenioType: varchar("convenio_type", { length: 80 }),
  convenioNotes: text("convenio_notes"),
  convenioExpiresAt: date("convenio_expires_at"),
  // Client approval / aval del cliente
  hasClientApproval: boolean("has_client_approval").default(false),
  clientApprovalDate: date("client_approval_date"),
  clientApprovalBy: varchar("client_approval_by", { length: 150 }),
  clientApprovalNotes: text("client_approval_notes"),
  clientApprovalImageUrl: text("client_approval_image_url"),
  // Convenio image
  convenioImageUrl: text("convenio_image_url"),
  municipalityFiscalSnapshot: varchar("municipality_fiscal_snapshot", {
    length: 100,
  }),
  taxZoneSnapshot: taxZoneEnum("tax_zone_snapshot"),
  clientPriceType: varchar("client_price_type", { length: 20 }),
  clientId: uuid("client_id").references(() => clients.id),
  paymentType: paymentTypeEnum("payment_type").default("CASH"),
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
  // SIIGO integration tracking
  siigoStatus: varchar("siigo_status", { length: 20 }),
  siigoInvoiceId: varchar("siigo_invoice_id", { length: 80 }),
  siigoInvoiceNumber: varchar("siigo_invoice_number", { length: 80 }),
  siigoIssuedAt: timestamp("siigo_issued_at", { withTimezone: true }),
  siigoSentAt: timestamp("siigo_sent_at", { withTimezone: true }),
  siigoLastSyncAt: timestamp("siigo_last_sync_at", { withTimezone: true }),
  siigoErrorMessage: text("siigo_error_message"),
});

/* =========================
   ORDER ITEMS (DISEÑOS) & REVISIONES
========================= */
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id),
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  additionId: uuid("addition_id").references(() => additions.id, {
    onDelete: "set null",
  }),
  name: varchar("name", { length: 255 }),
  garmentType: varchar("garment_type", { length: 30 }),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
  totalPrice: numeric("total_price", { precision: 14, scale: 2 }),
  hasAdditions: boolean("has_additions").default(false),
  additionEvidence: text("addition_evidence"),
  observations: text("observations"),
  fabric: varchar("fabric", { length: 100 }),
  imageUrl: text("image_url"),
  clothingImageOneUrl: text("clothing_image_one_url"),
  clothingImageTwoUrl: text("clothing_image_two_url"),
  logoImageUrl: text("logo_image_url"),
  screenPrint: boolean("screen_print").default(false),
  screenPrintType: varchar("screen_print_type", { length: 20 }),
  embroidery: boolean("embroidery").default(false),
  buttonhole: boolean("buttonhole").default(false),
  snap: boolean("snap").default(false),
  tag: boolean("tag").default(false),
  flag: boolean("flag").default(false),
  gender: varchar("gender", { length: 50 }),
  designType: designTypeEnum("design_type"),
  productionTechnique: productionTechniqueEnum("production_technique"),
  process: varchar("process", { length: 100 }),
  designerId: uuid("designer_id").references(() => employees.id),
  discipline: varchar("discipline", { length: 100 }),
  hasCordon: boolean("has_cordon").default(false),
  cordonColor: varchar("cordon_color", { length: 80 }),
  category: varchar("category", { length: 80 }),
  labelBrand: varchar("label_brand", { length: 100 }),
  estimatedLeadDays: integer("estimated_lead_days"),
  neckType: varchar("neck_type", { length: 100 }),
  cuffType: varchar("cuff_type", { length: 80 }),
  sleeve: varchar("sleeve", { length: 100 }),
  color: varchar("color", { length: 100 }),
  requiresSocks: boolean("requires_socks").default(false),
  isActive: boolean("is_active").default(true),
  manufacturingId: varchar("manufacturing_id", { length: 100 }),
  status: orderItemStatusEnum("status").notNull(),
  requiresRevision: boolean("requires_revision").default(false),
  ticketMontaje: varchar("ticket_montaje", { length: 80 }),
  ticketPlotter: varchar("ticket_plotter", { length: 80 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  // Design deadline: calculated from operationalApprovedAt + estimatedLeadDays
  designDeadline: date("design_deadline"),
});

export const orderItemPositions = pgTable("order_item_positions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  position: positionEnum("position").notNull(),
  quantity: integer("quantity").notNull().default(0),
  color: varchar("color", { length: 80 }),
  sortOrder: integer("sort_order").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const orderItemTeams = pgTable("order_item_teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  playerColor: varchar("player_color", { length: 80 }),
  goalkeeperColor: varchar("goalkeeper_color", { length: 80 }),
  socksColor: varchar("socks_color", { length: 80 }),
  playerImageUrl: text("player_image_url"),
  goalkeeperImageUrl: text("goalkeeper_image_url"),
  fullSetImageUrl: text("full_set_image_url"),
  sortOrder: integer("sort_order").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const orderItemAdditions = pgTable("order_item_additions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  additionId: uuid("addition_id")
    .notNull()
    .references(() => additions.id, { onDelete: "cascade" }),
  quantity: numeric("quantity", { precision: 12, scale: 2 })
    .notNull()
    .default("1"),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  position: positionEnum("position"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const orderItemPackaging = pgTable("order_item_packaging", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id").references(() => orderItems.id),
  teamId: uuid("team_id").references(() => orderItemTeams.id, {
    onDelete: "set null",
  }),
  position: positionEnum("position"),
  mode: varchar("mode", { length: 20 }).default("AGRUPADO"),
  size: varchar("size", { length: 50 }).default(""),
  quantity: integer("quantity"),
  personName: varchar("person_name", { length: 255 }),
  personNumber: varchar("person_number", { length: 50 }),
});

export const orderItemSocks = pgTable("order_item_socks", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id").references(() => orderItems.id),
  teamId: uuid("team_id").references(() => orderItemTeams.id, {
    onDelete: "set null",
  }),
  position: positionEnum("position"),
  sockLength: sockLengthEnum("sock_length"),
  color: varchar("color", { length: 80 }),
  material: varchar("material", { length: 80 }),
  isDesigned: boolean("is_designed").default(false),
  size: varchar("size", { length: 50 }).default(""),
  quantity: integer("quantity"),
  description: text("description"),
  imageUrl: text("image_url"),
  logoImageUrl: text("logo_image_url"),
});

export const orderItemSpecialRequirements = pgTable(
  "order_item_special_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    piece: varchar("piece", { length: 30 }),
    fabric: varchar("fabric", { length: 100 }),
    fabricColor: varchar("fabric_color", { length: 80 }),
    hasReflectiveTape: boolean("has_reflective_tape").default(false),
    reflectiveTapeLocation: varchar("reflective_tape_location", {
      length: 150,
    }),
    hasSideStripes: boolean("has_side_stripes").default(false),
    cuffType: varchar("cuff_type", { length: 80 }),
    closureType: varchar("closure_type", { length: 80 }),
    closureQuantity: integer("closure_quantity"),
    hasCordon: boolean("has_cordon").default(false),
    hasElastic: boolean("has_elastic").default(false),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
);

export const orderItemMaterials = pgTable("order_item_materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id").references(() => orderItems.id),
  inventoryItemId: uuid("inventory_item_id").references(
    () => inventoryItems.id,
  ),
  quantity: numeric("quantity", { precision: 12, scale: 2 }),
  note: text("note"),
});

export const orderItemIssues = pgTable("order_item_issues", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id),
  message: text("message").notNull(),
  role: varchar("role", { length: 150 }),
  statusSnapshot: varchar("status_snapshot", { length: 50 }),
  createdBy: uuid("created_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const orderItemRevisions = pgTable("order_item_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id").references(() => orderItems.id),
  reason: text("reason").notNull(),
  changedBy: uuid("changed_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   HISTORIAL DE ESTADOS (ORDER ITEM)
========================= */
export const orderStatusHistory = pgTable("order_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id),
  status: orderStatusEnum("status"),
  changedBy: uuid("changed_by").references(() => employees.id),
  reasonCode: varchar("reason_code", { length: 80 }),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const orderItemStatusHistory = pgTable("order_item_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id").references(() => orderItems.id),
  status: orderItemStatusEnum("status"),
  changedBy: uuid("changed_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   CONFECCIONISTAS (Proveedores/Talleres)
========================= */
export const confectionists = pgTable("confectionists", {
  id: uuid("id").defaultRandom().primaryKey(),

  // --- CÓDIGO AUTOGENERADO ---
  confectionistCode: varchar("confectionist_code", { length: 20 })
    .unique()
    .notNull(),

  // --- DOCUMENTOS ---
  identityDocumentUrl: varchar("identity_document_url", { length: 500 }),
  rutDocumentUrl: varchar("rut_document_url", { length: 500 }),
  commerceChamberDocumentUrl: varchar("commerce_chamber_document_url", {
    length: 500,
  }),
  passportDocumentUrl: varchar("passport_document_url", { length: 500 }),
  taxCertificateDocumentUrl: varchar("tax_certificate_document_url", {
    length: 500,
  }),
  companyIdDocumentUrl: varchar("company_id_document_url", { length: 500 }),
  bankCertificateUrl: varchar("bank_certificate_url", { length: 500 }),

  // --- IDENTIFICACIÓN Y NOMBRE (Estandarizado) ---
  name: varchar("name", { length: 255 }).notNull(), // "Nombre tercero"
  identificationType: identificationTypeEnum("identification_type").notNull(), // CC o NIT (común en talleres)
  identification: varchar("identification", { length: 20 }).unique().notNull(),
  dv: varchar("dv", { length: 1 }), // Vital si el confeccionista es una empresa (NIT)

  // --- CARACTERIZACIÓN ---
  // Reemplazamos el type simple por uno más descriptivo si es necesario
  type: varchar("type", { length: 50 }), // Ej: "Taller Externo", "Sastrería", "Planta Propia"
  specialty: varchar("specialty", { length: 100 }),
  taxRegime: taxRegimeEnum("tax_regime").notNull(), // Necesario para pagos y retenciones

  // --- CONTACTO Y TELÉFONOS (Estructura Imagen 1) ---
  contactName: varchar("contact_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  intlDialCode: varchar("intl_dial_code", { length: 5 }).default("57"),
  mobile: varchar("mobile", { length: 20 }),
  fullMobile: varchar("full_mobile", { length: 25 }),
  landline: varchar("landline", { length: 20 }),
  extension: varchar("extension", { length: 10 }),

  // --- UBICACIÓN (Para logística de entrega y recogida) ---
  address: varchar("address", { length: 255 }).notNull(),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }).default("COLOMBIA"),
  department: varchar("department", { length: 100 }).default("ANTIOQUIA"),
  city: varchar("city", { length: 100 }).default("Medellín"),

  // --- ESTADO ---
  isActive: boolean("is_active").default(false),
  dailyCapacity: integer("daily_capacity"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   ORDER ITEM ↔ CONFECCIONISTA
========================= */
export const orderItemConfection = pgTable("order_item_confection", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id").references(() => orderItems.id),
  confectionistId: uuid("confectionist_id").references(() => confectionists.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  // Payment fields (added migration 0069)
  status: varchar("status", { length: 30 }).notNull().default("ASIGNADO"),
  qtyAssigned: integer("qty_assigned"),
  unitRate: numeric("unit_rate", { precision: 12, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
  paymentNotes: text("payment_notes"),
  confectionistRateId: uuid("confectionist_rate_id"),
});

/* =========================
   SUPPLIERS (Proveedores)
========================= */
export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),

  // --- CÓDIGO AUTOGENERADO ---
  supplierCode: varchar("supplier_code", { length: 20 }).unique().notNull(), // "PROV1001", "PROV1002", etc.

  // --- DOCUMENTOS ---
  identityDocumentUrl: varchar("identity_document_url", { length: 500 }),
  rutDocumentUrl: varchar("rut_document_url", { length: 500 }),
  commerceChamberDocumentUrl: varchar("commerce_chamber_document_url", {
    length: 500,
  }),
  passportDocumentUrl: varchar("passport_document_url", { length: 500 }),
  taxCertificateDocumentUrl: varchar("tax_certificate_document_url", {
    length: 500,
  }),
  companyIdDocumentUrl: varchar("company_id_document_url", { length: 500 }),
  bankCertificateUrl: varchar("bank_certificate_url", { length: 500 }),

  // --- IDENTIFICACIÓN Y NOMBRE (Estandarizado) ---
  name: varchar("name", { length: 255 }).notNull(), // "Nombre tercero"
  identificationType: identificationTypeEnum("identification_type").notNull(), // NIT es el más común aquí
  identification: varchar("identification", { length: 20 }).unique().notNull(),
  dv: varchar("dv", { length: 1 }), // Crítico para NIT empresarial
  branch: varchar("branch", { length: 10 }).default("01"), // "Sucursal" (ej. Sede principal del proveedor)

  // --- INFORMACIÓN FISCAL Y CONTACTO ---
  taxRegime: taxRegimeEnum("tax_regime").notNull(), // Crucial para retenciones en la fuente
  contactName: varchar("contact_name", { length: 255 }).notNull(), // "NOMBRE DE CONTACTO"
  email: varchar("email", { length: 255 }).notNull(), // Para envío de Órdenes de Compra

  // --- UBICACIÓN (Basado en Estructura Imagen 1/2) ---
  address: varchar("address", { length: 255 }).notNull(),
  postalCode: varchar("postal_code", { length: 20 }),
  country: varchar("country", { length: 100 }).default("COLOMBIA"),
  department: varchar("department", { length: 100 }).default("ANTIOQUIA"),
  city: varchar("city", { length: 100 }).default("Medellín"),

  // --- TELÉFONOS Y MARCACIÓN (Estructura Compleja) ---
  intlDialCode: varchar("intl_dial_code", { length: 5 }).default("57"),
  mobile: varchar("mobile", { length: 20 }),
  fullMobile: varchar("full_mobile", { length: 25 }),
  localDialCode: varchar("local_dial_code", { length: 5 }),
  landline: varchar("landline", { length: 20 }),
  extension: varchar("extension", { length: 10 }),
  fullLandline: varchar("full_landline", { length: 30 }),

  // --- CRÉDITO Y FINANZAS ---
  isActive: boolean("is_active").default(false),
  hasCredit: boolean("has_credit").default(false), // "CREDITO"
  promissoryNoteNumber: varchar("promissory_note_number", { length: 50 }), // "NUMERO PAGARE"
  promissoryNoteDate: date("promissory_note_date"), // "FECHA FIRMA PAGARE"

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   PACKERS (Empaque / Empacadores)
========================= */
export const packers = pgTable("packers", {
  id: uuid("id").defaultRandom().primaryKey(),

  // --- CÓDIGO AUTOGENERADO ---
  packerCode: varchar("packer_code", { length: 20 }).unique().notNull(), // "EMPA1001", "EMPA1002", etc.

  // --- DOCUMENTOS ---
  identityDocumentUrl: varchar("identity_document_url", { length: 500 }),
  rutDocumentUrl: varchar("rut_document_url", { length: 500 }),
  commerceChamberDocumentUrl: varchar("commerce_chamber_document_url", {
    length: 500,
  }),
  passportDocumentUrl: varchar("passport_document_url", { length: 500 }),
  taxCertificateDocumentUrl: varchar("tax_certificate_document_url", {
    length: 500,
  }),
  companyIdDocumentUrl: varchar("company_id_document_url", { length: 500 }),

  // --- IDENTIFICACIÓN Y NOMBRE ---
  name: varchar("name", { length: 255 }).notNull(),
  identificationType: identificationTypeEnum("identification_type").notNull(),
  identification: varchar("identification", { length: 20 }).unique().notNull(),
  dv: varchar("dv", { length: 1 }),

  // --- ESPECIFICACIONES DE OPERACIÓN ---
  packerType: varchar("packer_type", { length: 50 }), // Interno, Satélite, Distribuidora
  specialty: varchar("specialty", { length: 100 }), // Prenda colgada, Caja master, Etiquetado

  // --- CONTACTO Y TELÉFONOS ---
  contactName: varchar("contact_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  intlDialCode: varchar("intl_dial_code", { length: 5 }).default("57"),
  mobile: varchar("mobile", { length: 20 }),
  fullMobile: varchar("full_mobile", { length: 25 }),
  landline: varchar("landline", { length: 20 }),

  // --- UBICACIÓN ---
  address: varchar("address", { length: 255 }).notNull(),
  postalCode: varchar("postal_code", { length: 20 }),
  city: varchar("city", { length: 100 }).default("Medellín"),
  department: varchar("department", { length: 100 }).default("ANTIOQUIA"),

  // --- ESTADO Y CAPACIDAD ---
  isActive: boolean("is_active").default(false),
  dailyCapacity: integer("daily_capacity"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   ORDER ITEM ↔ PACKER
========================= */
export const orderItemPacker = pgTable("order_item_packer", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id").references(() => orderItems.id),
  packerId: uuid("packer_id").references(() => packers.id),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  // Payment fields (added migration 0069)
  status: varchar("status", { length: 30 }).notNull().default("ASIGNADO"),
  qtyAssigned: integer("qty_assigned"),
  unitRate: numeric("unit_rate", { precision: 12, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
  paymentNotes: text("payment_notes"),
  packerRateId: uuid("packer_rate_id"),
});

/* =========================
   INVENTORY ITEMS
========================= */
export const inventoryCategories = pgTable("inventory_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: inventoryCategoryTypeEnum("type").notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const warehouses = pgTable("warehouses", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 30 }).unique().notNull(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  purpose: warehousePurposeEnum("purpose").default("GENERAL"),
  isVirtual: boolean("is_virtual").default(false),
  isExternal: boolean("is_external").default(false),
  mirroredWarehouseId: uuid("mirrored_warehouse_id"),
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 100 }).default("Medellín"),
  department: varchar("department", { length: 100 }).default("ANTIOQUIA"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemCode: varchar("item_code", { length: 30 }).unique().notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => inventoryCategories.id),
  unit: varchar("unit", { length: 50 }).notNull(),
  hasVariants: boolean("has_variants").default(true).notNull(),
  price: numeric("price", { precision: 14, scale: 2 }).default("0"),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const inventoryItemVariants = pgTable("inventory_item_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  inventoryItemId: uuid("inventory_item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  sku: varchar("sku", { length: 50 }).unique().notNull(),
  color: varchar("color", { length: 80 }),
  size: varchar("size", { length: 50 }),
  description: varchar("description", { length: 255 }),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const warehouseStock = pgTable(
  "warehouse_stock",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id),
    inventoryItemId: uuid("inventory_item_id").references(
      () => inventoryItems.id,
    ),
    variantId: uuid("variant_id").references(() => inventoryItemVariants.id),
    availableQty: numeric("available_qty", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    reservedQty: numeric("reserved_qty", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    minStock: numeric("min_stock", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("warehouse_stock_unique").on(
      t.warehouseId,
      t.inventoryItemId,
      t.variantId,
    ),
  }),
);

/* =========================
   PURCHASE ORDERS
========================= */
export const banks = pgTable("banks", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 30 }).unique().notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  accountRef: varchar("account_ref", { length: 80 }).notNull(),
  isOfficial: boolean("is_official").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const purchaseRequirements = pgTable(
  "purchase_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 30 }).notNull().default("BORRADOR"),
    hintsSnapshot: jsonb("hints_snapshot"),
    createdBy: uuid("created_by").references(() => employees.id),
    approvedBy: uuid("approved_by").references(() => employees.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqueOrderItem: uniqueIndex("purchase_requirements_order_item_unique").on(
      t.orderItemId,
    ),
  }),
);

export const purchaseRequirementLines = pgTable("purchase_requirement_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseRequirementId: uuid("purchase_requirement_id")
    .notNull()
    .references(() => purchaseRequirements.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 40 }).notNull().default("INSUMO"),
  description: text("description").notNull(),
  qtyPlanned: numeric("qty_planned", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  unit: varchar("unit", { length: 30 }).default("UN"),
  qtyOrdered: numeric("qty_ordered", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  qtyReceived: numeric("qty_received", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  coverageStatus: varchar("coverage_status", { length: 30 })
    .notNull()
    .default("PENDIENTE"),
  inventoryItemId: uuid("inventory_item_id").references(
    () => inventoryItems.id,
  ),
  // BOM link (added migration 0068)
  orderItemMoldingInsumoId: uuid("order_item_molding_insumo_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const siigoSyncJobs = pgTable("siigo_sync_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobType: varchar("job_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("PENDIENTE"),
  bankId: uuid("bank_id").references(() => banks.id),
  requestedBy: uuid("requested_by").references(() => employees.id),
  payload: jsonb("payload"),
  result: jsonb("result"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderCode: varchar("purchase_order_code", { length: 20 }).unique(),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  createdBy: uuid("created_by").references(() => employees.id),
  status: purchaseOrderStatusEnum("status").default("PENDIENTE"),
  notes: text("notes"),
  bankId: uuid("bank_id").references(() => banks.id),
  bankName: varchar("bank_name", { length: 120 }),
  bankAccountRef: varchar("bank_account_ref", { length: 80 }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: uuid("approved_by").references(() => employees.id),
  approvalExpiresAt: timestamp("approval_expires_at", { withTimezone: true }),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectedBy: uuid("rejected_by").references(() => employees.id),
  rejectionReason: text("rejection_reason"),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  purchaseRequirementLineId: uuid("purchase_requirement_line_id").references(
    () => purchaseRequirementLines.id,
  ),
  inventoryItemId: uuid("inventory_item_id")
    .notNull()
    .references(() => inventoryItems.id),
  variantId: uuid("variant_id").references(() => inventoryItemVariants.id),
  itemCode: varchar("item_code", { length: 30 }).notNull(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
});

export const purchaseOrderReceipts = pgTable("purchase_order_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  receiptCode: varchar("receipt_code", { length: 30 }).notNull().unique(),
  notes: text("notes"),
  receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const purchaseOrderReceiptLines = pgTable(
  "purchase_order_receipt_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    receiptId: uuid("receipt_id")
      .notNull()
      .references(() => purchaseOrderReceipts.id, { onDelete: "cascade" }),
    purchaseOrderItemId: uuid("purchase_order_item_id")
      .notNull()
      .references(() => purchaseOrderItems.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id),
    receivedQty: numeric("received_qty", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    unitCost: numeric("unit_cost", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
);

export const purchaseOrderHistory = pgTable("purchase_order_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  action: varchar("action", { length: 80 }).notNull(),
  notes: text("notes"),
  performedBy: uuid("performed_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const purchaseOrderRoutes = pgTable("purchase_order_routes", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  routeType: purchaseOrderRouteTypeEnum("route_type").notNull(),
  partyType: purchaseOrderPartyTypeEnum("party_type").notNull(),
  partyId: uuid("party_id"),
  partyLabel: varchar("party_label", { length: 255 }),
  driverLabel: varchar("driver_label", { length: 255 }),
  vehiclePlate: varchar("vehicle_plate", { length: 20 }),
  originArea: varchar("origin_area", { length: 120 }).notNull(),
  destinationArea: varchar("destination_area", { length: 120 }).notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  status: purchaseOrderRouteStatusEnum("status").default("PENDIENTE"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   CONFECTIONIST RATES (Tarifas globales confeccionistas)
========================= */
export const confectionistRates = pgTable(
  "confectionist_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    garmentType: varchar("garment_type", { length: 40 }).notNull(),
    garmentSubtype: varchar("garment_subtype", { length: 40 }),
    process: varchar("process", { length: 40 }),
    sizeRange: varchar("size_range", { length: 20 }),
    ratePerUnit: numeric("rate_per_unit", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("COP"),
    unit: varchar("unit", { length: 20 }).notNull().default("UN"),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => employees.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    garmentIdx: index("confectionist_rates_garment_idx").on(t.garmentType, t.process),
    activeIdx: index("confectionist_rates_active_idx").on(t.isActive, t.validFrom, t.validTo),
  }),
);

/* =========================
   PACKER RATES (Tarifas globales empacadores)
========================= */
export const packerRates = pgTable(
  "packer_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    garmentType: varchar("garment_type", { length: 40 }).notNull(),
    garmentSubtype: varchar("garment_subtype", { length: 40 }),
    process: varchar("process", { length: 40 }),
    sizeRange: varchar("size_range", { length: 20 }),
    ratePerUnit: numeric("rate_per_unit", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull().default("COP"),
    unit: varchar("unit", { length: 20 }).notNull().default("UN"),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => employees.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    garmentIdx: index("packer_rates_garment_idx").on(t.garmentType, t.process),
  }),
);

/* =========================
   CONFECTIONIST PAYMENT REQUESTS (Solicitudes de pago confeccionistas)
========================= */
export const confectionistPaymentRequests = pgTable(
  "confectionist_payment_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestCode: varchar("request_code", { length: 30 }).notNull(),
    orderItemConfectionId: uuid("order_item_confection_id")
      .notNull()
      .references(() => orderItemConfection.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("PENDIENTE"),
    notes: text("notes"),
    requestedBy: uuid("requested_by").references(() => employees.id),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow(),
    verifiedBy: uuid("verified_by").references(() => employees.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => employees.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentReference: varchar("payment_reference", { length: 120 }),
    bankId: uuid("bank_id").references(() => banks.id),
    accountingEntryId: uuid("accounting_entry_id"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    codeUnique: uniqueIndex("confectionist_payment_requests_code_unique").on(t.requestCode),
    statusIdx: index("cpr_status_idx").on(t.status),
    confectionIdx: index("cpr_confection_idx").on(t.orderItemConfectionId),
  }),
);

/* =========================
   PACKER PAYMENT REQUESTS (Solicitudes de pago empacadores)
========================= */
export const packerPaymentRequests = pgTable(
  "packer_payment_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requestCode: varchar("request_code", { length: 30 }).notNull(),
    orderItemPackerId: uuid("order_item_packer_id")
      .notNull()
      .references(() => orderItemPacker.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("PENDIENTE"),
    notes: text("notes"),
    requestedBy: uuid("requested_by").references(() => employees.id),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow(),
    verifiedBy: uuid("verified_by").references(() => employees.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => employees.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentReference: varchar("payment_reference", { length: 120 }),
    bankId: uuid("bank_id").references(() => banks.id),
    accountingEntryId: uuid("accounting_entry_id"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    codeUnique: uniqueIndex("packer_payment_requests_code_unique").on(t.requestCode),
    statusIdx: index("ppr_status_idx").on(t.status),
    packerIdx: index("ppr_packer_idx").on(t.orderItemPackerId),
  }),
);

/* =========================
   SUPPLIER INVOICES (Facturas de proveedores)
========================= */
export const supplierInvoices = pgTable(
  "supplier_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invoiceCode: varchar("invoice_code", { length: 30 }).notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id),
    purchaseOrderReceiptId: uuid("purchase_order_receipt_id").references(
      () => purchaseOrderReceipts.id,
      { onDelete: "set null" },
    ),
    supplierInvoiceNumber: varchar("supplier_invoice_number", { length: 80 }),
    invoiceDate: date("invoice_date").notNull(),
    dueDate: date("due_date"),
    currency: varchar("currency", { length: 10 }).notNull().default("COP"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
    ivaAmount: numeric("iva_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    withholdingTax: numeric("withholding_tax", { precision: 14, scale: 2 }).notNull().default("0"),
    withholdingIva: numeric("withholding_iva", { precision: 14, scale: 2 }).notNull().default("0"),
    withholdingIca: numeric("withholding_ica", { precision: 14, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
    // status: RECIBIDA → VERIFICADA → APROBADA → CONTABILIZADA → PAGADA | RECHAZADA
    status: varchar("status", { length: 30 }).notNull().default("RECIBIDA"),
    notes: text("notes"),
    documentUrl: text("document_url"),
    verifiedBy: uuid("verified_by").references(() => employees.id),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => employees.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    accountingEntryId: uuid("accounting_entry_id"),
    createdBy: uuid("created_by").references(() => employees.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    codeUnique: uniqueIndex("supplier_invoices_code_unique").on(t.invoiceCode),
    supplierIdx: index("si_supplier_idx").on(t.supplierId),
    poIdx: index("si_po_idx").on(t.purchaseOrderId),
    receiptIdx: index("si_receipt_idx").on(t.purchaseOrderReceiptId),
    statusIdx: index("si_status_idx").on(t.status),
  }),
);

/* =========================
   SUPPLIER PAYMENTS (Pagos a proveedores)
========================= */
export const supplierPayments = pgTable(
  "supplier_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentCode: varchar("payment_code", { length: 30 }).notNull(),
    supplierInvoiceId: uuid("supplier_invoice_id")
      .notNull()
      .references(() => supplierInvoices.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    paymentDate: date("payment_date").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    bankId: uuid("bank_id").references(() => banks.id),
    referenceNumber: varchar("reference_number", { length: 120 }),
    // status: PENDIENTE → COMPLETADO | RECHAZADO
    status: varchar("status", { length: 30 }).notNull().default("PENDIENTE"),
    notes: text("notes"),
    accountingEntryId: uuid("accounting_entry_id"),
    createdBy: uuid("created_by").references(() => employees.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    codeUnique: uniqueIndex("supplier_payments_code_unique").on(t.paymentCode),
    invoiceIdx: index("sp_invoice_idx").on(t.supplierInvoiceId),
    statusIdx: index("sp_status_idx").on(t.status),
  }),
);

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  movementType: stockMovementTypeEnum("movement_type").notNull(),
  reason: stockMovementReasonEnum("reason").notNull(),
  notes: text("notes"),
  inventoryItemId: uuid("inventory_item_id").references(
    () => inventoryItems.id,
  ),
  variantId: uuid("variant_id").references(() => inventoryItemVariants.id),
  fromWarehouseId: uuid("from_warehouse_id").references(() => warehouses.id),
  toWarehouseId: uuid("to_warehouse_id").references(() => warehouses.id),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 14, scale: 2 }),
  referenceType: stockMovementReferenceTypeEnum("reference_type"),
  referenceId: uuid("reference_id"),
  transferStatus: warehouseTransferStatusEnum("transfer_status"),
  requestedBy: uuid("requested_by").references(() => employees.id),
  requestedAt: timestamp("requested_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   SHIPMENTS
========================= */
export const shipments = pgTable("shipments", {
  id: uuid("id").defaultRandom().primaryKey(),
  mode: shipmentModeEnum("mode").notNull().default("INTERNAL"),
  fromArea: varchar("from_area", { length: 80 }).notNull(),
  toArea: varchar("to_area", { length: 80 }).notNull(),
  recipientId: uuid("recipient_id"),
  recipientName: varchar("recipient_name", { length: 180 }),
  sentBy: varchar("sent_by", { length: 120 }).notNull(),
  orderCode: varchar("order_code", { length: 40 }).notNull(),
  designName: varchar("design_name", { length: 255 }).notNull(),
  size: varchar("size", { length: 50 }).notNull(),
  routePath: varchar("route_path", { length: 255 }).notNull(),
  isReceived: boolean("is_received").notNull().default(false),
  receivedBy: varchar("received_by", { length: 120 }),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  paymentStatus: shipmentPaymentStatusEnum("payment_status").default("NA"),
  customerDocumentType: shipmentDocumentTypeEnum("customer_document_type"),
  documentRef: shipmentDocumentRefEnum("document_ref"),
  emailMode: shipmentEmailModeEnum("email_mode"),
  emailTo: varchar("email_to", { length: 255 }),
  clientId: uuid("client_id").references(() => clients.id),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   ORDER SUPPLIES
========================= */
export const orderSupplies = pgTable(
  "order_supplies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id),
    supplierId: uuid("supplier_id").references(() => suppliers.id),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("order_supplies_order_item_inventory_item_uniq").on(
      t.orderItemId,
      t.inventoryItemId,
    ),
  }),
);

/* =========================
   PAYMENTS
========================= */
export const orderPayments = pgTable("order_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  depositAmount: numeric("deposit_amount", { precision: 14, scale: 2 }),
  referenceCode: varchar("reference_code", { length: 120 }),
  method: paymentMethodEnum("method"),
  bankId: uuid("bank_id").references(() => banks.id),
  transferBank: varchar("transfer_bank", { length: 120 }),
  transferCurrency: varchar("transfer_currency", { length: 5 }),
  status: paymentStatusEnum("status").default("PENDIENTE"),
  proofImageUrl: text("proof_image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const cashReceipts = pgTable("cash_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  receiptCode: varchar("receipt_code", { length: 20 }).unique().notNull(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  prefacturaId: uuid("prefactura_id").references(() => prefacturas.id),
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
  prefacturaId: uuid("prefactura_id").references(() => prefacturas.id),
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
    .references(() => prefacturas.id),
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

export const accountingAccounts = pgTable(
  "accounting_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 20 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    type: accountingAccountTypeEnum("type").notNull(),
    normalBalance: accountingNormalBalanceEnum("normal_balance").notNull(),
    parentAccountId: uuid("parent_account_id"),
    description: text("description"),
    isPostable: boolean("is_postable").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata"),
    createdBy: uuid("created_by").references(() => employees.id),
    updatedBy: uuid("updated_by").references(() => employees.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    codeUnique: uniqueIndex("accounting_accounts_code_unique").on(table.code),
    nameIdx: index("accounting_accounts_name_idx").on(table.name),
    parentIdx: index("accounting_accounts_parent_idx").on(table.parentAccountId),
  }),
);

export const accountingPeriods = pgTable(
  "accounting_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    period: varchar("period", { length: 7 }).notNull(),
    status: accountingPeriodStatusEnum("status").notNull().default("OPEN"),
    openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow(),
    openedBy: uuid("opened_by").references(() => employees.id),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: uuid("closed_by").references(() => employees.id),
    closeReason: text("close_reason"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    periodUnique: uniqueIndex("accounting_periods_period_unique").on(
      table.period,
    ),
    statusIdx: index("accounting_periods_status_idx").on(table.status),
  }),
);

export const accountingEntries = pgTable(
  "accounting_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryNumber: varchar("entry_number", { length: 30 }).notNull(),
    period: varchar("period", { length: 7 }).notNull(),
    entryDate: date("entry_date").notNull(),
    status: accountingEntryStatusEnum("status").notNull().default("DRAFT"),
    sourceModule: accountingSourceModuleEnum("source_module")
      .notNull()
      .default("GENERAL"),
    sourceType: varchar("source_type", { length: 80 }),
    sourceId: uuid("source_id"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    description: text("description").notNull(),
    externalReference: varchar("external_reference", { length: 120 }),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => employees.id),
    reversalOfId: uuid("reversal_of_id"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversedBy: uuid("reversed_by").references(() => employees.id),
    metadata: jsonb("metadata"),
    createdBy: uuid("created_by").references(() => employees.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    entryNumberUnique: uniqueIndex("accounting_entries_number_unique").on(
      table.entryNumber,
    ),
    idempotencyUnique: uniqueIndex("accounting_entries_idempotency_unique").on(
      table.idempotencyKey,
    ),
    periodIdx: index("accounting_entries_period_idx").on(table.period),
    sourceIdx: index("accounting_entries_source_idx").on(
      table.sourceModule,
      table.sourceType,
    ),
  }),
);

export const accountingEntryLines = pgTable(
  "accounting_entry_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => accountingEntries.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountingAccounts.id),
    thirdPartyType: thirdPartyTypeEnum("third_party_type"),
    thirdPartyId: uuid("third_party_id"),
    description: text("description"),
    debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
    credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
    lineOrder: integer("line_order").notNull().default(0),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    entryIdx: index("accounting_entry_lines_entry_idx").on(table.entryId),
    accountIdx: index("accounting_entry_lines_account_idx").on(table.accountId),
    entryOrderUnique: uniqueIndex("accounting_entry_lines_entry_order_unique").on(
      table.entryId,
      table.lineOrder,
    ),
  }),
);

export const accountingEventMappings = pgTable(
  "accounting_event_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventCode: varchar("event_code", { length: 80 }).notNull(),
    sourceModule: accountingSourceModuleEnum("source_module")
      .notNull()
      .default("GENERAL"),
    description: text("description"),
    config: jsonb("config").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => employees.id),
    updatedBy: uuid("updated_by").references(() => employees.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    eventCodeUnique: uniqueIndex("accounting_event_mappings_code_unique").on(
      table.eventCode,
    ),
    moduleIdx: index("accounting_event_mappings_module_idx").on(
      table.sourceModule,
    ),
  }),
);

export const accountingEntryHistory = pgTable(
  "accounting_entry_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => accountingEntries.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 80 }).notNull(),
    notes: text("notes"),
    payload: jsonb("payload"),
    performedBy: uuid("performed_by").references(() => employees.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    entryHistoryIdx: index("accounting_entry_history_entry_idx").on(table.entryId),
  }),
);

export const bankReconciliations = pgTable("bank_reconciliations", {
  id: uuid("id").defaultRandom().primaryKey(),
  bankId: uuid("bank_id")
    .notNull()
    .references(() => banks.id),
  period: varchar("period", { length: 7 }).notNull(),
  balancePerBank: numeric("balance_per_bank", {
    precision: 14,
    scale: 2,
  }).notNull(),
  balancePerBooks: numeric("balance_per_books", {
    precision: 14,
    scale: 2,
  }).notNull(),
  difference: numeric("difference", { precision: 14, scale: 2 }).notNull(),
  isClosed: boolean("is_closed").default(false),
  closedBy: uuid("closed_by").references(() => employees.id),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  createdBy: uuid("created_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const bankReconciliationItems = pgTable("bank_reconciliation_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  reconciliationId: uuid("reconciliation_id")
    .notNull()
    .references(() => bankReconciliations.id, { onDelete: "cascade" }),
  itemDate: date("item_date").notNull(),
  description: text("description").notNull(),
  booksAmount: numeric("books_amount", { precision: 14, scale: 2 }),
  bankAmount: numeric("bank_amount", { precision: 14, scale: 2 }),
  difference: numeric("difference", { precision: 14, scale: 2 }),
  itemType: reconciliationItemTypeEnum("item_type").notNull(),
  cashReceiptId: uuid("cash_receipt_id").references(() => cashReceipts.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const taxZoneRates = pgTable("tax_zone_rates", {
  taxZone: taxZoneEnum("tax_zone").primaryKey(),
  withholdingTaxRate: numeric("withholding_tax_rate", {
    precision: 7,
    scale: 4,
  })
    .notNull()
    .default("0"),
  withholdingIcaRate: numeric("withholding_ica_rate", {
    precision: 7,
    scale: 4,
  })
    .notNull()
    .default("0"),
  withholdingIvaRate: numeric("withholding_iva_rate", {
    precision: 7,
    scale: 4,
  })
    .notNull()
    .default("0"),
  updatedBy: uuid("updated_by").references(() => employees.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const payrollProvisions = pgTable("payroll_provisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  period: varchar("period", { length: 7 }).notNull(),
  baseSalary: numeric("base_salary", { precision: 14, scale: 2 }).notNull(),
  transportAllowance: numeric("transport_allowance", {
    precision: 14,
    scale: 2,
  }).default("0"),
  severancePay: numeric("severance_pay", { precision: 14, scale: 2 }).notNull(),
  severanceInterests: numeric("severance_interests", {
    precision: 14,
    scale: 2,
  }).notNull(),
  serviceBonus: numeric("service_bonus", { precision: 14, scale: 2 }).notNull(),
  vacationProvision: numeric("vacation_provision", {
    precision: 14,
    scale: 2,
  }).notNull(),
  healthContribution: numeric("health_contribution", {
    precision: 14,
    scale: 2,
  }).notNull(),
  pensionContribution: numeric("pension_contribution", {
    precision: 14,
    scale: 2,
  }).notNull(),
  arlContribution: numeric("arl_contribution", {
    precision: 14,
    scale: 2,
  }).notNull(),
  compensationBoxContribution: numeric("compensation_box_contribution", {
    precision: 14,
    scale: 2,
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const pilaGenerations = pgTable("pila_generations", {
  id: uuid("id").defaultRandom().primaryKey(),
  period: varchar("period", { length: 7 }).notNull(),
  generatedBy: uuid("generated_by").references(() => employees.id),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
});

export const employeeLeaves = pgTable("employee_leaves", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  leaveType: leaveTypeEnum("leave_type").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  hoursAbsent: numeric("hours_absent", { precision: 5, scale: 2 }),
  payrollDeduction: boolean("payroll_deduction").default(false),
  notes: text("notes"),
  approvedBy: uuid("approved_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const employeeRequests = pgTable("employee_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  type: employeeRequestTypeEnum("type").notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  requestDate: date("request_date"),
  requestHours: numeric("request_hours", { precision: 4, scale: 2 }),
  priority: employeeRequestPriorityEnum("priority").notNull().default("MEDIA"),
  status: employeeRequestStatusEnum("status").notNull().default("PENDIENTE"),
  responseNotes: text("response_notes"),
  resolvedBy: uuid("resolved_by").references(() => employees.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const operativeDashboardLogs = pgTable("operative_dashboard_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  roleArea: varchar("role_area", { length: 30 }).notNull().default("OPERARIOS"),
  operationType: varchar("operation_type", { length: 40 }),
  orderCode: varchar("order_code", { length: 60 }).notNull(),
  designName: varchar("design_name", { length: 255 }).notNull(),
  details: text("details"),
  size: varchar("size", { length: 40 }),
  quantityOp: integer("quantity_op").notNull().default(0),
  producedQuantity: integer("produced_quantity").notNull().default(0),
  startAt: timestamp("start_at", { withTimezone: true }),
  endAt: timestamp("end_at", { withTimezone: true }),
  isComplete: boolean("is_complete").notNull().default(false),
  isPartial: boolean("is_partial").notNull().default(false),
  observations: text("observations"),
  repoCheck: boolean("repo_check").notNull().default(false),
  processCode: varchar("process_code", { length: 1 }).notNull().default("P"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   NOTIFICATIONS
========================= */
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title"),
  message: text("message").notNull(),
  role: varchar("role", { length: 150 }),
  href: text("href"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   EXCHANGE RATES (USD -> COP)
========================= */
export const exchangeRates = pgTable("exchange_rates", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: varchar("provider", { length: 100 }).notNull(),
  baseCurrency: varchar("base_currency", { length: 3 })
    .notNull()
    .default("USD"),
  targetCurrency: varchar("target_currency", { length: 3 })
    .notNull()
    .default("COP"),
  sourceRate: numeric("source_rate", { precision: 14, scale: 4 }).notNull(),
  floorRate: numeric("floor_rate", { precision: 14, scale: 4 })
    .notNull()
    .default("3600"),
  effectiveRate: numeric("effective_rate", {
    precision: 14,
    scale: 4,
  }).notNull(),
  adjustmentApplied: numeric("adjustment_applied", { precision: 14, scale: 4 })
    .notNull()
    .default("0"),
  sourceDate: timestamp("source_date", { withTimezone: true }),
  rawPayload: text("raw_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const advisorCommissionRates = pgTable("advisor_commission_rates", {
  id: uuid("id").defaultRandom().primaryKey(),
  advisorName: varchar("advisor_name", { length: 150 }).notNull().unique(),
  rate: numeric("rate", { precision: 8, scale: 6 }).notNull().default("0.05"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   LEGAL STATUS (Genérico para todos los terceros)
========================= */
export const legalStatusRecords = pgTable("legal_status_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  thirdPartyId: uuid("third_party_id").notNull(),
  thirdPartyType: thirdPartyTypeEnum("third_party_type").notNull(),
  thirdPartyName: varchar("third_party_name", { length: 255 }).notNull(),
  status: legalStatusEnum("status").notNull().default("EN_REVISION"),
  notes: text("notes"),
  reviewedBy: varchar("reviewed_by", { length: 255 }),
  changedFields: text("changed_fields"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   MOLDING TEMPLATES
   Versioned base catalog for molding patterns
========================= */
export const moldingTemplates = pgTable(
  "molding_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    moldingCode: varchar("molding_code", { length: 50 }).notNull(),
    version: integer("version").notNull().default(1),
    garmentType: varchar("garment_type", { length: 80 }),
    garmentSubtype: varchar("garment_subtype", { length: 80 }),
    designDetail: varchar("design_detail", { length: 255 }),
    fabric: varchar("fabric", { length: 100 }),
    color: varchar("color", { length: 100 }),
    gender: varchar("gender", { length: 50 }),
    imageUrl: text("image_url"),
    clothingImageOneUrl: text("clothing_image_one_url"),
    clothingImageTwoUrl: text("clothing_image_two_url"),
    logoImageUrl: text("logo_image_url"),
    process: varchar("process", { length: 100 }),
    estimatedLeadDays: integer("estimated_lead_days"),
    manufacturingId: varchar("manufacturing_id", { length: 100 }),
    screenPrint: boolean("screen_print").default(false),
    embroidery: boolean("embroidery").default(false),
    buttonhole: boolean("buttonhole").default(false),
    snap: boolean("snap").default(false),
    tag: boolean("tag").default(false),
    flag: boolean("flag").default(false),
    neckType: varchar("neck_type", { length: 100 }),
    sesgoType: varchar("sesgo_type", { length: 80 }),
    sesgoColor: varchar("sesgo_color", { length: 80 }),
    hiladillaColor: varchar("hiladilla_color", { length: 80 }),
    sleeveType: varchar("sleeve_type", { length: 80 }),
    cuffType: varchar("cuff_type", { length: 80 }),
    cuffMaterial: varchar("cuff_material", { length: 80 }),
    zipperLocation: varchar("zipper_location", { length: 80 }),
    zipperColor: varchar("zipper_color", { length: 80 }),
    zipperSizeCm: numeric("zipper_size_cm", { precision: 6, scale: 1 }),
    cordColor: varchar("cord_color", { length: 80 }),
    hasElastic: boolean("has_elastic").default(false),
    liningType: varchar("lining_type", { length: 80 }),
    liningColor: varchar("lining_color", { length: 80 }),
    hoodType: varchar("hood_type", { length: 80 }),
    hasInnerLining: boolean("has_inner_lining").default(false),
    hasPocket: boolean("has_pocket").default(false),
    pocketZipperColor: varchar("pocket_zipper_color", { length: 80 }),
    hasLateralMesh: boolean("has_lateral_mesh").default(false),
    lateralMeshColor: varchar("lateral_mesh_color", { length: 80 }),
    hasFajon: boolean("has_fajon").default(false),
    hasTanca: boolean("has_tanca").default(false),
    hasProtection: boolean("has_protection").default(false),
    buttonType: varchar("button_type", { length: 80 }),
    buttonholeType: varchar("buttonhole_type", { length: 80 }),
    perillaColor: varchar("perilla_color", { length: 80 }),
    collarType: varchar("collar_type", { length: 80 }),
    fusioningNotes: text("fusioning_notes"),
    hasEntretela: boolean("has_entretela").default(false),
    invisibleZipperColor: varchar("invisible_zipper_color", { length: 80 }),
    observations: text("observations"),
    compatibleFabrics: text("compatible_fabrics"),
    isActive: boolean("is_active").default(true),
    deprecatedAt: timestamp("deprecated_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => employees.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [uniqueIndex("uq_molding_code_version").on(t.moldingCode, t.version)],
);

/* =========================
   MOLDING TEMPLATE INSUMOS
   Base supply items per molding template
========================= */
export const moldingTemplateInsumos = pgTable(
  "molding_template_insumos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    moldingTemplateId: uuid("molding_template_id")
      .notNull()
      .references(() => moldingTemplates.id, { onDelete: "cascade" }),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id),
    variantId: uuid("variant_id").references(() => inventoryItemVariants.id),
    qtyPerUnit: numeric("qty_per_unit", { precision: 10, scale: 4 }).notNull(),
    unit: varchar("unit", { length: 50 }).notNull(),
    variesBySize: boolean("varies_by_size").default(false),
    additionId: uuid("addition_id").references(() => additions.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_mti_template_item_variant_addition").on(
      t.moldingTemplateId,
      t.inventoryItemId,
      t.variantId,
      t.additionId,
    ),
  ],
);

/* =========================
   MOLDING TEMPLATE SIZE ADJUSTMENTS
   Quantity adjustments per size for a template insumo
========================= */
export const moldingTemplateSizeAdjustments = pgTable(
  "molding_template_size_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    moldingTemplateInsumoId: uuid("molding_template_insumo_id")
      .notNull()
      .references(() => moldingTemplateInsumos.id, { onDelete: "cascade" }),
    size: varchar("size", { length: 20 }).notNull(),
    qtyPerUnit: numeric("qty_per_unit", { precision: 10, scale: 4 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_mtsa_insumo_size").on(t.moldingTemplateInsumoId, t.size),
  ],
);

/* =========================
   ORDER ITEM MOLDINGS
   Snapshot of molding data per order item
========================= */
export const orderItemMoldings = pgTable("order_item_moldings", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  moldingTemplateId: uuid("molding_template_id").references(
    () => moldingTemplates.id,
    { onDelete: "set null" },
  ),
  combinationOrder: integer("combination_order").notNull().default(1),
  // Snapshot of all technical fields from molding_templates
  moldingCode: varchar("molding_code", { length: 50 }),
  version: integer("version"),
  garmentType: varchar("garment_type", { length: 80 }),
  garmentSubtype: varchar("garment_subtype", { length: 80 }),
  designDetail: varchar("design_detail", { length: 255 }),
  fabric: varchar("fabric", { length: 100 }),
  color: varchar("color", { length: 100 }),
  gender: varchar("gender", { length: 50 }),
  imageUrl: text("image_url"),
  clothingImageOneUrl: text("clothing_image_one_url"),
  clothingImageTwoUrl: text("clothing_image_two_url"),
  logoImageUrl: text("logo_image_url"),
  screenPrint: boolean("screen_print").default(false),
  embroidery: boolean("embroidery").default(false),
  buttonhole: boolean("buttonhole").default(false),
  snap: boolean("snap").default(false),
  tag: boolean("tag").default(false),
  flag: boolean("flag").default(false),
  process: varchar("process", { length: 100 }),
  estimatedLeadDays: integer("estimated_lead_days"),
  manufacturingId: varchar("manufacturing_id", { length: 100 }),
  neckType: varchar("neck_type", { length: 100 }),
  sesgoType: varchar("sesgo_type", { length: 80 }),
  sesgoColor: varchar("sesgo_color", { length: 80 }),
  hiladillaColor: varchar("hiladilla_color", { length: 80 }),
  sleeveType: varchar("sleeve_type", { length: 80 }),
  cuffType: varchar("cuff_type", { length: 80 }),
  cuffMaterial: varchar("cuff_material", { length: 80 }),
  zipperLocation: varchar("zipper_location", { length: 80 }),
  zipperColor: varchar("zipper_color", { length: 80 }),
  zipperSizeCm: numeric("zipper_size_cm", { precision: 6, scale: 1 }),
  cordColor: varchar("cord_color", { length: 80 }),
  hasElastic: boolean("has_elastic").default(false),
  liningType: varchar("lining_type", { length: 80 }),
  liningColor: varchar("lining_color", { length: 80 }),
  hoodType: varchar("hood_type", { length: 80 }),
  hasInnerLining: boolean("has_inner_lining").default(false),
  hasPocket: boolean("has_pocket").default(false),
  pocketZipperColor: varchar("pocket_zipper_color", { length: 80 }),
  hasLateralMesh: boolean("has_lateral_mesh").default(false),
  lateralMeshColor: varchar("lateral_mesh_color", { length: 80 }),
  hasFajon: boolean("has_fajon").default(false),
  hasTanca: boolean("has_tanca").default(false),
  hasProtection: boolean("has_protection").default(false),
  buttonType: varchar("button_type", { length: 80 }),
  buttonholeType: varchar("buttonhole_type", { length: 80 }),
  perillaColor: varchar("perilla_color", { length: 80 }),
  collarType: varchar("collar_type", { length: 80 }),
  fusioningNotes: text("fusioning_notes"),
  hasEntretela: boolean("has_entretela").default(false),
  invisibleZipperColor: varchar("invisible_zipper_color", { length: 80 }),
  observations: text("observations"),
  assignedBy: uuid("assigned_by").references(() => employees.id),
  updatedBy: uuid("updated_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   ORDER ITEM MOLDING INSUMOS
   Actual calculated supplies for an order item molding
========================= */
export const orderItemMoldingInsumos = pgTable(
  "order_item_molding_insumos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderItemMoldingId: uuid("order_item_molding_id")
      .notNull()
      .references(() => orderItemMoldings.id, { onDelete: "cascade" }),
    moldingTemplateInsumoId: uuid("molding_template_insumo_id").references(
      () => moldingTemplateInsumos.id,
      { onDelete: "set null" },
    ),
    inventoryItemId: uuid("inventory_item_id")
      .notNull()
      .references(() => inventoryItems.id),
    variantId: uuid("variant_id").references(() => inventoryItemVariants.id),
    additionId: uuid("addition_id").references(() => additions.id),
    size: varchar("size", { length: 20 }),
    qtyRequired: numeric("qty_required", {
      precision: 12,
      scale: 4,
    }).notNull(),
    qtyAvailable: numeric("qty_available", {
      precision: 12,
      scale: 4,
    })
      .notNull()
      .default("0"),
    qtyToPurchase: numeric("qty_to_purchase", {
      precision: 12,
      scale: 4,
    })
      .notNull()
      .default("0"),
    unit: varchar("unit", { length: 50 }).notNull(),
    status: moldingInsumoStatusEnum("status").notNull().default("PENDIENTE"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_oimi_molding_item_variant_addition_size").on(
      t.orderItemMoldingId,
      t.inventoryItemId,
      t.variantId,
      t.additionId,
      t.size,
    ),
  ],
);

/* =========================
   MES - COLA DE PRODUCCIÓN
========================= */

export {
  mesProductionQueue,
  mesTicketAssignments,
  mesItemTags,
  mesEnvios,
  mesEnvioItems,
  mesShipments,
  mesShipmentItems,
} from "./mes/schema";

/* =========================
   ESTADO JURÍDICO ACTUAL DE CLIENTES
========================= */

export const clientLegalStatus = pgTable("client_legal_status", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id")
    .notNull()
    .unique()
    .references(() => clients.id, { onDelete: "cascade" }),
  isLegallyEnabled: boolean("is_legally_enabled").notNull().default(true),
  legalNotes: text("legal_notes"),
  enabledAt: timestamp("enabled_at", { withTimezone: true }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  updatedBy: uuid("updated_by").references(() => employees.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
   CAJA MENOR (PETTY CASH)
========================= */

export const pettyCashFunds = pgTable("petty_cash_funds", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  responsibleEmployeeId: uuid("responsible_employee_id").references(
    () => employees.id,
  ),
  initialBalance: numeric("initial_balance", {
    precision: 14,
    scale: 2,
  })
    .notNull()
    .default("0"),
  currentBalance: numeric("current_balance", {
    precision: 14,
    scale: 2,
  })
    .notNull()
    .default("0"),
  maxBalance: numeric("max_balance", { precision: 14, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 5 }).notNull().default("COP"),
  status: pettyCashFundStatusEnum("status").notNull().default("ACTIVE"),
  createdBy: uuid("created_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const pettyCashTransactions = pgTable("petty_cash_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionCode: varchar("transaction_code", { length: 30 })
    .unique()
    .notNull(),
  fundId: uuid("fund_id")
    .notNull()
    .references(() => pettyCashFunds.id),
  transactionDate: date("transaction_date").notNull(),
  transactionType: pettyCashTransactionTypeEnum("transaction_type").notNull(),
  category: varchar("category", { length: 100 }),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  balanceBefore: numeric("balance_before", {
    precision: 14,
    scale: 2,
  })
    .notNull()
    .default("0"),
  balanceAfter: numeric("balance_after", {
    precision: 14,
    scale: 2,
  })
    .notNull()
    .default("0"),
  referenceCode: varchar("reference_code", { length: 120 }),
  attachmentUrl: text("attachment_url"),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
