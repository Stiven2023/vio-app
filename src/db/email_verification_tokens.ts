import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  token: varchar("token", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});
