import {
  boolean,
  index,
  integer,
  jsonb,
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
  mesPaymentStatusValues,
  mesPriorityValues,
  mesProductionStageAreaValues,
  mesQueueStatusValues,
  mesRepoReasonValues,
  mesReposicionStatusValues,
  mesSampleApprovalStatusValues,
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

export const mesPaymentStatusPgEnum = pgEnum(
  "mes_payment_status",
  mesPaymentStatusValues,
);

export const mesSampleApprovalStatusPgEnum = pgEnum(
  "mes_sample_approval_status",
  mesSampleApprovalStatusValues,
);

export const mesReposicionStatusPgEnum = pgEnum(
  "mes_reposicion_status",
  mesReposicionStatusValues,
);

export const mesProductionStageAreaPgEnum = pgEnum(
  "mes_production_stage_area",
  mesProductionStageAreaValues,
);

export const mesRepoReasonPgEnum = pgEnum(
  "mes_repo_reason",
  mesRepoReasonValues,
);

export const mesPriorityEnum = mesPriorityPgEnum;
export const mesQueueStatusEnum = mesQueueStatusPgEnum;
export const mesAssignmentStatusEnum = mesAssignmentStatusPgEnum;
export const mesItemTagEnum = mesItemTagPgEnum;
export const mesShipmentAreaEnum = mesShipmentAreaPgEnum;
export const mesTransportTypeEnum = mesTransportTypePgEnum;
export const mesEnvioStatusEnum = mesEnvioStatusPgEnum;
export const mesPaymentStatusEnum = mesPaymentStatusPgEnum;
export const mesSampleApprovalStatusEnum = mesSampleApprovalStatusPgEnum;
export const mesReposicionStatusEnum = mesReposicionStatusPgEnum;
export const mesProductionStageAreaEnum = mesProductionStageAreaPgEnum;
export const mesRepoReasonEnum = mesRepoReasonPgEnum;

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
    dispatchApprovals: jsonb("dispatch_approvals"),
    status: mesEnvioStatusEnum("status").notNull().default("CREADO"),
    salidaAt: timestamp("salida_at", { withTimezone: true }),
    llegadaAt: timestamp("llegada_at", { withTimezone: true }),
    retornoAt: timestamp("retorno_at", { withTimezone: true }),
    // Tracking despacho matriz
    logisticOperator: varchar("logistic_operator", { length: 100 }),
    destinationAddress: text("destination_address"),
    paymentStatus: mesPaymentStatusEnum("payment_status").notNull().default("PENDIENTE"),
    requiresDeclaredValue: boolean("requires_declared_value").notNull().default(false),
    courierBroughtBy: varchar("courier_brought_by", { length: 150 }),
    receptionLocation: varchar("reception_location", { length: 200 }),
    receptionStatus: varchar("reception_status", { length: 50 }),
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
    packedQuantity: integer("packed_quantity"),
    notes: text("notes"),
  },
  (t) => [index("idx_mes_envio_items_order_item_id").on(t.orderItemId)],
);

export const mesShipmentStatusPgEnum = mesEnvioStatusPgEnum;
export const mesShipmentStatusEnum = mesEnvioStatusEnum;
export const mesShipments = mesEnvios;
export const mesShipmentItems = mesEnvioItems;

// ─── Etapas de producción por área ─────────────────────────────────────────

export const mesProductionStages = pgTable(
  "mes_production_stages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // External references to ERP orders/order_items
    orderId: uuid("order_id").notNull(),
    orderItemId: uuid("order_item_id").notNull(),
    area: mesProductionStageAreaEnum("area").notNull(),
    stageName: varchar("stage_name", { length: 100 }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    // External references to ERP employees / MES machines
    operatorId: uuid("operator_id"),
    operatorName: varchar("operator_name", { length: 150 }),
    machineId: varchar("machine_id", { length: 60 }),
    machineName: varchar("machine_name", { length: 100 }),
    quantityProcessed: integer("quantity_processed").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_mes_production_stages_order_id").on(t.orderId),
    index("idx_mes_production_stages_order_item_id").on(t.orderItemId),
    index("idx_mes_production_stages_operator_id").on(t.operatorId),
    index("idx_mes_production_stages_area").on(t.area),
  ],
);

// ─── Reposiciones ────────────────────────────────────────────────────────────

export const mesReposiciones = pgTable(
  "mes_reposiciones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositionCode: varchar("reposition_code", { length: 20 }).notNull().unique(),
    // External references to ERP
    orderId: uuid("order_id").notNull(),
    orderItemId: uuid("order_item_id").notNull(),
    causeCode: mesRepoReasonEnum("cause_code").notNull(),
    requestingProcess: varchar("requesting_process", { length: 80 }),
    quantityRequested: integer("quantity_requested").notNull().default(1),
    status: mesReposicionStatusEnum("status").notNull().default("ABIERTA"),
    notes: text("notes"),
    // External references to ERP employees.id
    requestedBy: uuid("requested_by"),
    closedBy: uuid("closed_by"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_mes_reposiciones_order_id").on(t.orderId),
    index("idx_mes_reposiciones_order_item_id").on(t.orderItemId),
    index("idx_mes_reposiciones_reposition_code").on(t.repositionCode),
    index("idx_mes_reposiciones_status").on(t.status),
  ],
);

// ─── Seguimiento de aprobación de muestra en orden ──────────────────────────
// Extiende mesProductionQueue con pin de montaje y aprobación de muestra.
// Se persiste en tabla separada para no alterar el PK de la cola existente.

export const mesSampleApprovals = pgTable(
  "mes_sample_approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // External reference to ERP orders.id (1-to-1)
    orderId: uuid("order_id").notNull().unique(),
    assemblyPin: varchar("assembly_pin", { length: 50 }),
    sampleApprovalStatus: mesSampleApprovalStatusEnum("sample_approval_status")
      .notNull()
      .default("PENDIENTE"),
    sampleApprovedAt: timestamp("sample_approved_at", { withTimezone: true }),
    sampleApprovedBy: varchar("sample_approved_by", { length: 150 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_mes_sample_approvals_order_id").on(t.orderId),
    index("idx_mes_sample_approvals_status").on(t.sampleApprovalStatus),
  ],
);
