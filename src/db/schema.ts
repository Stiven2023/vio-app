// Enum de estados de órdenes de compra
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "PENDIENTE",
  "APROBADA",
  "RECHAZADA",
  "EN_PROCESO",
  "FINALIZADA",
  "CANCELADA",
]);

// Enum de tipo de cliente
export const clientTypeEnum = pgEnum("client_type", [
  "NACIONAL",
  "EXTRANJERO",
  "EMPLEADO",
]);

// Enum de tipo de identificación
export const identificationTypeEnum = pgEnum("identification_type", [
  "CC",
  "NIT",
  "CE",
  "PAS",
  "EMPRESA_EXTERIOR",
]);

// Enum de régimen fiscal
export const taxRegimeEnum = pgEnum("tax_regime", [
  "REGIMEN_COMUN",
  "REGIMEN_SIMPLIFICADO",
  "NO_RESPONSABLE",
]);

// Enum de estado de cliente
export const clientStatusEnum = pgEnum("client_status", [
  "ACTIVO",
  "INACTIVO",
  "SUSPENDIDO",
]);

// Enum de tipo de cliente para precios COP
export const clientPriceTypeEnum = pgEnum("client_price_type", [
  "AUTORIZADO",
  "MAYORISTA",
  "VIOMAR",
  "COLANTA",
]);

// Enum de tipo de tercero (para módulo jurídico)
export const thirdPartyTypeEnum = pgEnum("third_party_type", [
  "EMPLEADO",
  "CLIENTE",
  "CONFECCIONISTA",
  "PROVEEDOR",
  "EMPAQUE",
]);

// Enum de estado jurídico
export const legalStatusEnum = pgEnum("legal_status_status", [
  "VIGENTE",           // Sin problemas, puede operar
  "EN_REVISION",       // Bajo revisión, operación pendiente
  "RESTRICCION",       // Con restricciones, operación limitada
  "BLOQUEADO",         // Bloqueado, no puede operar
]);

import {
  boolean,
  date,
  integer,
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

// Enum de roles
export const roleEnum = pgEnum("role", [
  "ADMINISTRADOR",
  "LIDER_DE_PROCESOS",
  "ASESOR",
  "COMPRAS",
  "DISEÑADOR",
  "OPERARIO_EMPAQUE",
  "OPERARIO_INVENTARIO",
  "OPERARIO_INTEGRACION",
  "OPERARIO_CORTE_LASER",
  "OPERARIO_CORTE_MANUAL",
  "OPERARIO_IMPRESION",
  "OPERARIO_ESTAMPACION",
  "OPERARIO_MONTAJE",
  "OPERARIO_SUBLIMACION",
]);

// Enum de permisos
export const permissionEnum = pgEnum("permission", [
  // Pedidos
  "CREAR_PEDIDO",
  "EDITAR_PEDIDO",
  "ELIMINAR_PEDIDO",
  "VER_PEDIDO",
  "CAMBIAR_ESTADO_PEDIDO",
  // Diseños
  "CREAR_DISEÑO",
  "EDITAR_DISEÑO",
  "ELIMINAR_DISEÑO",
  "VER_DISEÑO",
  "EDITAR_IMAGEN",
  "ASIGNAR_DISEÑO",
  "CAMBIAR_ESTADO_DISEÑO",
  // Pagos
  "CREAR_PAGO",
  "EDITAR_PAGO",
  "APROBAR_PAGO",
  "VER_PAGO",
  // Inventario
  "CREAR_ITEM_INVENTARIO",
  "EDITAR_ITEM_INVENTARIO",
  "ELIMINAR_ITEM_INVENTARIO",
  "VER_ITEM_INVENTARIO",
  "REGISTRAR_ENTRADA",
  "REGISTRAR_SALIDA",
  "VER_INVENTARIO",
  // Empaque
  "CREAR_EMPAQUE",
  "EDITAR_EMPAQUE",
  "ELIMINAR_EMPAQUE",
  "MARCAR_EMPAQUE",
  "VER_EMPAQUE",
  // Compras
  "CREAR_ORDEN_COMPRA",
  "ASOCIAR_PROVEEDOR",
  // Proveedores
  "CREAR_PROVEEDOR",
  "EDITAR_PROVEEDOR",
  "ELIMINAR_PROVEEDOR",
  "VER_PROVEEDOR",
  // Clientes
  "CREAR_CLIENTE",
  "EDITAR_CLIENTE",
  "ELIMINAR_CLIENTE",
  "VER_CLIENTE",
  // Confeccionistas
  "CREAR_CONFECCIONISTA",
  "EDITAR_CONFECCIONISTA",
  "ELIMINAR_CONFECCIONISTA",
  "VER_CONFECCIONISTA",
  "ASIGNAR_CONFECCIONISTA",
  // Notificaciones
  "VER_NOTIFICACION",
  "ELIMINAR_NOTIFICACION",
  // Historial
  "VER_HISTORIAL_ESTADO",
]);

/* =========================
	 ENUMS (POSTGRES)
========================= */
export const orderTypeEnum = pgEnum("order_type", ["VN", "VI"]);

export const orderKindEnum = pgEnum("order_kind", [
  "NUEVO",
  "COMPLETACION",
  "REFERENTE",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "PENDIENTE",
  "PRODUCCION",
  "ATRASADO",
  "FINALIZADO",
  "ENTREGADO",
  "CANCELADO",
  "REVISION",
]);

export const orderItemStatusEnum = pgEnum("order_item_status", [
  "PENDIENTE",
  "REVISION_ADMIN",
  "APROBACION_INICIAL",
  "PENDIENTE_PRODUCCION",
  "EN_MONTAJE",
  "EN_IMPRESION",
  "SUBLIMACION",
  "CORTE_MANUAL",
  "CORTE_LASER",
  "PENDIENTE_CONFECCION",
  "CONFECCION",
  "EN_BODEGA",
  "EMPAQUE",
  "ENVIADO",
  "EN_REVISION_CAMBIO",
  "APROBADO_CAMBIO",
  "RECHAZADO_CAMBIO",
  "COMPLETADO",
  "CANCELADO",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "EFECTIVO",
  "TRANSFERENCIA",
  "CREDITO",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDIENTE",
  "PARCIAL",
  "PAGADO",
  "ANULADO",
]);

export const inventoryLocationEnum = pgEnum("inventory_location", [
  "BODEGA_PRINCIPAL",
  "TIENDA",
]);

/* =========================
	 USERS (AUTH)
========================= */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: text("password_hash").notNull(),
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
    roleId: uuid("role_id").notNull().references(() => roles.id),
    permissionId: uuid("permission_id").notNull().references(() => permissions.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
  }),
);

/* =========================
   EMPLOYEES (Ajustado)
========================= */
export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  
  // --- CÓDIGO AUTOGENERADO ---
  employeeCode: varchar("employee_code", { length: 20 }).unique().notNull(),
  
  // --- IDENTIFICACIÓN Y NOMBRE (Basado en Maestro) ---
  name: varchar("name", { length: 255 }).notNull(), // "Nombre tercero"
  identificationType: identificationTypeEnum("identification_type").notNull(), // CC, CE, etc.
  identification: varchar("identification", { length: 20 }).unique().notNull(),
  dv: varchar("dv", { length: 1 }), // Dígito de verificación (si aplica)
  
  // --- CONTACTO DETALLADO (Basado en Estructura Imagen 1) ---
  email: varchar("email", { length: 255 }).notNull(),
  intlDialCode: varchar("intl_dial_code", { length: 5 }).default("57"),
  mobile: varchar("mobile", { length: 20 }),
  fullMobile: varchar("full_mobile", { length: 25 }), // Concatenado para el programa
  landline: varchar("landline", { length: 20 }),
  extension: varchar("extension", { length: 10 }),

  // --- UBICACIÓN (Consistencia con Clientes) ---
  address: varchar("address", { length: 255 }),
  city: varchar("city", { length: 100 }).default("Medellín"),
  department: varchar("department", { length: 100 }).default("ANTIOQUIA"),

  // --- ROL Y ESTADO ---
  roleId: uuid("role_id").references(() => roles.id),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
	 CLIENTS
========================= */
export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // --- CÓDIGO DE CLIENTE AUTOMÁTICO ---
  clientCode: varchar("client_code", { length: 20 }).unique().notNull(), // "CN10001", "CE10001", "EM10001"
  clientType: clientTypeEnum("client_type").notNull(), // NACIONAL, EXTRANJERO, EMPLEADO
  
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
  priceClientType: clientPriceTypeEnum("price_client_type")
    .default("VIOMAR")
    .notNull(), // AUTORIZADO, MAYORISTA, VIOMAR, COLANTA (solo precios COP)
  isActive: boolean("is_active").default(true), // "Estado" (mantener por compatibilidad)
  hasCredit: boolean("has_credit").default(false), // "CREDITO"
  promissoryNoteNumber: varchar("promissory_note_number", { length: 50 }), // "NUMERO PAGARE"
  promissoryNoteDate: date("promissory_note_date"), // "FECHA FIRMA PAGARE"
  
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
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  categoryId: uuid("category_id").references(() => categories.id),
  isSet: boolean("is_set").default(false),
  productionType: varchar("production_type", { length: 30 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const productPrices = pgTable("product_prices", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").references(() => products.id),
  referenceCode: varchar("reference_code", { length: 50 }).unique().notNull(),
  priceCOP: numeric("price_cop", { precision: 14, scale: 2 }),
  priceUSD: numeric("price_usd", { precision: 14, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
});

/* =========================
	 ORDERS
========================= */
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderCode: varchar("order_code", { length: 20 }).unique().notNull(),
  clientId: uuid("client_id").references(() => clients.id),
  type: orderTypeEnum("type").notNull(),
  kind: orderKindEnum("kind").default("NUEVO"),
  sourceOrderId: uuid("source_order_id"),
  status: orderStatusEnum("status").notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).default("0"),
  ivaEnabled: boolean("iva_enabled").default(false),
  discount: numeric("discount", { precision: 14, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 5 }).default("COP"),
  shippingFee: numeric("shipping_fee", { precision: 14, scale: 2 }).default(
    "0",
  ),
  createdBy: uuid("created_by").references(() => employees.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
	 ORDER ITEMS (DISEÑOS) & REVISIONES
========================= */
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id),
  productId: uuid("product_id").references(() => products.id),
  productPriceId: uuid("product_price_id").references(() => productPrices.id),
  name: varchar("name", { length: 255 }),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
  totalPrice: numeric("total_price", { precision: 14, scale: 2 }),
  observations: text("observations"),
  fabric: varchar("fabric", { length: 100 }),
  imageUrl: text("image_url"),
  screenPrint: boolean("screen_print").default(false),
  embroidery: boolean("embroidery").default(false),
  buttonhole: boolean("buttonhole").default(false),
  snap: boolean("snap").default(false),
  tag: boolean("tag").default(false),
  flag: boolean("flag").default(false),
  gender: varchar("gender", { length: 50 }),
  process: varchar("process", { length: 100 }),
  neckType: varchar("neck_type", { length: 100 }),
  sleeve: varchar("sleeve", { length: 100 }),
  color: varchar("color", { length: 100 }),
  requiresSocks: boolean("requires_socks").default(false),
  isActive: boolean("is_active").default(true),
  manufacturingId: varchar("manufacturing_id", { length: 100 }),
  status: orderItemStatusEnum("status").notNull(),
  requiresRevision: boolean("requires_revision").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const orderItemPackaging = pgTable("order_item_packaging", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id").references(() => orderItems.id),
  mode: varchar("mode", { length: 20 }).default("AGRUPADO"),
  size: varchar("size", { length: 50 }).default(""),
  quantity: integer("quantity"),
  personName: varchar("person_name", { length: 255 }),
  personNumber: varchar("person_number", { length: 50 }),
});

export const orderItemSocks = pgTable("order_item_socks", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id").references(() => orderItems.id),
  size: varchar("size", { length: 50 }).default(""),
  quantity: integer("quantity"),
  description: text("description"),
  imageUrl: text("image_url"),
});

export const orderItemMaterials = pgTable("order_item_materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id").references(() => orderItems.id),
  inventoryItemId: uuid("inventory_item_id").references(() => inventoryItems.id),
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
  confectionistCode: varchar("confectionist_code", { length: 20 }).unique().notNull(),
  
  // --- IDENTIFICACIÓN Y NOMBRE (Estandarizado) ---
  name: varchar("name", { length: 255 }).notNull(), // "Nombre tercero"
  identificationType: identificationTypeEnum("identification_type").notNull(), // CC o NIT (común en talleres)
  identification: varchar("identification", { length: 20 }).unique().notNull(),
  dv: varchar("dv", { length: 1 }), // Vital si el confeccionista es una empresa (NIT)
  
  // --- CARACTERIZACIÓN ---
  // Reemplazamos el type simple por uno más descriptivo si es necesario
  type: varchar("type", { length: 50 }), // Ej: "Taller Externo", "Sastrería", "Planta Propia"
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
  isActive: boolean("is_active").default(true),
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
});


/* =========================
   SUPPLIERS (Proveedores)
========================= */
export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  
  // --- CÓDIGO AUTOGENERADO ---
  supplierCode: varchar("supplier_code", { length: 20 }).unique().notNull(), // "PROV1001", "PROV1002", etc.
  
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
  isActive: boolean("is_active").default(true),
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
  isActive: boolean("is_active").default(true),
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
});

/* =========================
	 INVENTORY ITEMS
========================= */
export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  unit: varchar("unit", { length: 50 }),
  price: numeric("price", { precision: 14, scale: 2 }).default("0"),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  minStock: numeric("min_stock", { precision: 12, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/* =========================
	 INVENTORY (STATE)
========================= */
export const inventory = pgTable("inventory", {
  id: uuid("id").defaultRandom().primaryKey(),
  inventoryItemId: uuid("inventory_item_id")
    .notNull()
    .unique()
    .references(() => inventoryItems.id),
  availableQty: numeric("available_qty", { precision: 12, scale: 2 }).default(
    "0",
  ),
  color: varchar("color", { length: 50 }),
  size: varchar("size", { length: 50 }),
  unit: varchar("unit", { length: 50 }).default("unit"),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  isActive: boolean("is_active").default(true),
});

/* =========================
	 PURCHASE ORDERS
========================= */
export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  status: purchaseOrderStatusEnum("status").default("PENDIENTE"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id),
  inventoryItemId: uuid("inventory_item_id")
    .notNull()
    .references(() => inventoryItems.id),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
});

/* =========================
	 INVENTORY ENTRIES
========================= */
export const inventoryEntries = pgTable("inventory_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  inventoryItemId: uuid("inventory_item_id").references(
    () => inventoryItems.id,
  ),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  location: inventoryLocationEnum("location").default("BODEGA_PRINCIPAL"),
  quantity: numeric("quantity", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
	 INVENTORY OUTPUTS
========================= */
export const inventoryOutputs = pgTable("inventory_outputs", {
  id: uuid("id").defaultRandom().primaryKey(),
  inventoryItemId: uuid("inventory_item_id").references(
    () => inventoryItems.id,
  ),
  orderItemId: uuid("order_item_id").references(() => orderItems.id),
  location: inventoryLocationEnum("location").default("BODEGA_PRINCIPAL"),
  quantity: numeric("quantity", { precision: 12, scale: 2 }),
  reason: varchar("reason", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
	 ORDER SUPPLIES
========================= */
export const orderSupplies = pgTable(
  "order_supplies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderItemId: uuid("order_item_id").notNull().references(() => orderItems.id),
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
  method: paymentMethodEnum("method"),
  status: paymentStatusEnum("status").default("PENDIENTE"),
  proofImageUrl: text("proof_image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
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
   ESTADO JURÍDICO (Legal Status)
========================= */
export const legalStatusRecords = pgTable("legal_status_records", {
  id: uuid("id").defaultRandom().primaryKey(),

  // --- VINCULACIÓN A TERCEROS ---
  thirdPartyId: uuid("third_party_id").notNull(), // ID del empleado/cliente/confeccionista/proveedor/empaque
  thirdPartyType: thirdPartyTypeEnum("third_party_type").notNull(), // Tipo de tercero
  thirdPartyName: varchar("third_party_name", { length: 255 }).notNull(), // Nombre del tercero para búsqueda

  // --- ESTADO JURÍDICO ---
  status: legalStatusEnum("status").default("VIGENTE").notNull(), // Estado actual
  notes: text("notes"), // Notas/observaciones

  // --- AUDITORÍA ---
  reviewedBy: uuid("reviewed_by").references(() => users.id), // Usuario que hizo la revisión
  lastReviewDate: timestamp("last_review_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
