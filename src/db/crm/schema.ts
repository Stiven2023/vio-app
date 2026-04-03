import {
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const crmContactStatusEnum = pgEnum("crm_contact_status", [
	"LEAD",
	"NEGOTIATION",
	"CLIENT",
	"SUPPORT",
]);

export const crmMessageDirectionEnum = pgEnum("crm_message_direction", [
	"INBOUND",
	"OUTBOUND",
]);

export const crmMessageStatusEnum = pgEnum("crm_message_status", [
	"SENT",
	"DELIVERED",
	"READ",
	"FAILED",
]);

export const crmContacts = pgTable(
	"crm_contacts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
		name: varchar("name", { length: 150 }),
		email: varchar("email", { length: 255 }),
		notes: text("notes"),
		status: crmContactStatusEnum("status").notNull().default("LEAD"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		lastInteraction: timestamp("last_interaction", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		uniqueIndex("crm_contacts_phone_number_unique").on(t.phoneNumber),
		index("idx_crm_contacts_last_interaction").on(t.lastInteraction),
		index("idx_crm_contacts_status").on(t.status),
	],
);

export const crmMessages = pgTable(
	"crm_messages",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		whatsappId: varchar("whatsapp_id", { length: 120 }).notNull(),
		content: text("content").notNull(),
		type: varchar("type", { length: 20 }).notNull().default("text"),
		direction: crmMessageDirectionEnum("direction").notNull(),
		status: crmMessageStatusEnum("status").notNull().default("SENT"),
		externalPayload: jsonb("external_payload"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		contactId: uuid("contact_id")
			.notNull()
			.references(() => crmContacts.id, { onDelete: "cascade" }),
	},
	(t) => [
		uniqueIndex("crm_messages_whatsapp_id_unique").on(t.whatsappId),
		index("idx_crm_messages_contact_id").on(t.contactId),
		index("idx_crm_messages_created_at").on(t.createdAt),
		index("idx_crm_messages_status").on(t.status),
	],
);

export const crmSchema = {
	crmContacts,
	crmMessages,
} as const;
