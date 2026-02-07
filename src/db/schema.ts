// Enum de estados de órdenes de compra
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "PENDIENTE",
  "APROBADA",
  "RECHAZADA",
  "EN_PROCESO",
  "FINALIZADA",
  "CANCELADA",
]);
import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
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
    roleId: uuid("role_id").references(() => roles.id),
    permissionId: uuid("permission_id").references(() => permissions.id),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.roleId, t.permissionId] }),
  }),
);

/* =========================
	 EMPLOYEES
========================= */
export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  roleId: uuid("role_id").references(() => roles.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
	 CLIENTS
========================= */
export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  identification: varchar("identification", { length: 20 }).unique().notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  city: varchar("city", { length: 100 }).default("Medellín"),
  isActive: boolean("is_active").default(true),
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
  status: orderStatusEnum("status").notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).default("0"),
  ivaEnabled: boolean("iva_enabled").default(false),
  discount: numeric("discount", { precision: 14, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 5 }).default("COP"),
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
  name: varchar("name", { length: 255 }),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
  totalPrice: numeric("total_price", { precision: 14, scale: 2 }),
  status: orderItemStatusEnum("status").notNull(),
  requiresRevision: boolean("requires_revision").default(false),
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
	 CONFECCIONISTAS
========================= */
export const confectionists = pgTable("confectionists", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }),
  phone: varchar("phone", { length: 50 }),
  isActive: boolean("is_active").default(true),
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
	 SUPPLIERS
========================= */
export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 255 }),
  isActive: boolean("is_active").default(true),
});

/* =========================
	 INVENTORY ITEMS
========================= */
export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 50 }),
  minStock: numeric("min_stock", { precision: 12, scale: 2 }).default("0"),
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
  quantity: numeric("quantity", { precision: 12, scale: 2 }),
  reason: varchar("reason", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
	 PAYMENTS
========================= */
export const orderPayments = pgTable("order_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").references(() => orders.id),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  method: paymentMethodEnum("method"),
  status: paymentStatusEnum("status").default("PENDIENTE"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* =========================
	 NOTIFICATIONS
========================= */
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
