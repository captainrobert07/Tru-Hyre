import { pgTable, serial, varchar, timestamp, boolean, pgEnum, text } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "hr", "client", "vendor"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  fullName: varchar("full_name", { length: 120 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  clientAccountId: serial("client_account_id"),
  vendorAccountId: serial("vendor_account_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
