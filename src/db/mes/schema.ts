import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import {
  mesAssignmentStatusValues,
  mesEnvioStatusValues,
  mesItemTagValues,
  mesPriorityValues,
  mesQueueStatusValues,
  mesShipmentAreaValues,
  mesTransportTypeValues,
} from "../enums";

export const mesPriorityPgEnum = pgEnum("mes_priority", mesPriorityValues);
export const mesQueueStatusPgEnum = pgEnum(
  "mes_queue_status",
  mesQueueStatusValues,
);
export const mesAssignmentStatusPgEnum = pgEnum(
  "mes_assignment_status",
  mesAssignmentStatusValues,
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

export const mesPriorityEnum = mesPriorityPgEnum;
export const mesQueueStatusEnum = mesQueueStatusPgEnum;
export const mesAssignmentStatusEnum = mesAssignmentStatusPgEnum;
export const mesItemTagEnum = mesItemTagPgEnum;
export const mesShipmentAreaEnum = mesShipmentAreaPgEnum;
export const mesTransportTypeEnum = mesTransportTypePgEnum;
export const mesEnvioStatusEnum = mesEnvioStatusPgEnum;

export const operativeDashboardLogs = pgTable(
  "operative_dashboard_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roleArea: varchar("role_area", { length: 30 })
      .notNull()
      .default("OPERARIOS"),
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
    // External reference to IAM users.id
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_operative_dashboard_logs_created_by_user_id").on(
      t.createdByUserId,
    ),
  ],
);

export const mesProductionQueue = pgTable(
  "mes_production_queue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // External references to ERP orders/order_items
    orderId: uuid("order_id").notNull(),
    orderItemId: uuid("order_item_id").notNull(),
    design: varchar("design", { length: 255 }).notNull(),
    size: varchar("size", { length: 40 }),
    quantityTotal: integer("quantity_total").notNull().default(0),
    priority: mesPriorityEnum("priority").notNull().default("NORMAL"),
    // External reference to ERP employees.id
    prioritySetBy: uuid("priority_set_by"),
    prioritySetAt: timestamp("priority_set_at", { withTimezone: true }),
    suggestedOrder: integer("suggested_order").notNull().default(0),
    finalOrder: integer("final_order").notNull().default(0),
    status: mesQueueStatusEnum("status").notNull().default("EN_COLA"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    // External reference to ERP employees.id
    confirmedBy: uuid("confirmed_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_mes_production_queue_order_id").on(t.orderId),
    index("idx_mes_production_queue_order_item_id").on(t.orderItemId),
    index("idx_mes_production_queue_priority_set_by").on(t.prioritySetBy),
    index("idx_mes_production_queue_confirmed_by").on(t.confirmedBy),
  ],
);

export const mesTicketAssignments = pgTable(
  "mes_ticket_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketRef: varchar("ticket_ref", { length: 50 }).notNull(),
    // External reference to ERP employees.id
    employeeId: uuid("employee_id"),
    process: varchar("process", { length: 50 }).notNull(),
    shiftLabel: varchar("shift_label", { length: 100 }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    status: mesAssignmentStatusEnum("status").notNull().default("ASIGNADO"),
    quantityReported: integer("quantity_reported").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_mes_ticket_assignments_employee_id").on(t.employeeId)],
);

export const mesItemTags = pgTable(
  "mes_item_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // External references to ERP order context
    orderId: uuid("order_id").notNull(),
    orderItemId: uuid("order_item_id").notNull(),
    tag: mesItemTagEnum("tag").notNull(),
    notes: text("notes"),
    // External reference to ERP employees.id
    setBy: uuid("set_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_mes_item_tags_order_id").on(t.orderId),
    index("idx_mes_item_tags_order_item_id").on(t.orderItemId),
    index("idx_mes_item_tags_set_by").on(t.setBy),
  ],
);

export const mesEnvios = pgTable(
  "mes_envios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // External reference to ERP orders.id
    orderId: uuid("order_id").notNull(),
    origenArea: mesShipmentAreaEnum("origen_area").notNull(),
    origenNombre: varchar("origen_nombre", { length: 150 }),
    destinoArea: mesShipmentAreaEnum("destino_area").notNull(),
    destinoNombre: varchar("destino_nombre", { length: 150 }),
    transporteTipo: mesTransportTypeEnum("transporte_tipo").notNull(),
    // External reference to ERP employees.id
    transportistaEmpleadoId: uuid("transportista_empleado_id"),
    transportistaNombre: varchar("transportista_nombre", { length: 150 }),
    empresaTercero: varchar("empresa_tercero", { length: 150 }),
    guiaNumero: varchar("guia_numero", { length: 80 }),
    placa: varchar("placa", { length: 20 }),
    requiereSegundaParada: boolean("requiere_segunda_parada")
      .notNull()
      .default(false),
    segundaParadaTipo: varchar("segunda_parada_tipo", { length: 80 }),
    segundaParadaDestino: varchar("segunda_parada_destino", { length: 200 }),
    observaciones: text("observaciones"),
    evidenciaUrl: text("evidencia_url"),
    status: mesEnvioStatusEnum("status").notNull().default("CREADO"),
    salidaAt: timestamp("salida_at", { withTimezone: true }),
    llegadaAt: timestamp("llegada_at", { withTimezone: true }),
    retornoAt: timestamp("retorno_at", { withTimezone: true }),
    // External reference to ERP employees.id
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_mes_envios_order_id").on(t.orderId),
    index("idx_mes_envios_transportista_empleado_id").on(
      t.transportistaEmpleadoId,
    ),
    index("idx_mes_envios_created_by").on(t.createdBy),
  ],
);

export const mesEnvioItems = pgTable(
  "mes_envio_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    envioId: uuid("envio_id")
      .notNull()
      .references(() => mesEnvios.id, { onDelete: "cascade" }),
    // External reference to ERP order_items.id
    orderItemId: uuid("order_item_id").notNull(),
    quantity: integer("quantity").notNull().default(0),
    notes: text("notes"),
  },
  (t) => [index("idx_mes_envio_items_order_item_id").on(t.orderItemId)],
);

export const mesShipmentStatusPgEnum = mesEnvioStatusPgEnum;
export const mesShipmentStatusEnum = mesEnvioStatusEnum;
export const mesShipments = mesEnvios;
export const mesShipmentItems = mesEnvioItems;
