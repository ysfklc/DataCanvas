import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, json, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: text("password"),
  role: varchar("role", { length: 50 }).notNull().default("standard"),
  authMethod: varchar("auth_method", { length: 50 }).notNull().default("local"),
  isActive: boolean("is_active").notNull().default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dashboards = pgTable("dashboards", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  logoUrl: varchar("logo_url", { length: 500 }),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessLevel: varchar("access_level", { length: 50 }).notNull().default("private"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dataSources = pgTable("data_sources", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // 'api', 'scraping', 'database'
  config: json("config").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastPullAt: timestamp("last_pull_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dashboardCards = pgTable("dashboard_cards", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  dashboardId: uuid("dashboard_id").notNull().references(() => dashboards.id, { onDelete: "cascade" }),
  dataSourceId: uuid("data_source_id").references(() => dataSources.id, { onDelete: "set null" }),
  title: varchar("title", { length: 255 }).notNull(),
  visualizationType: varchar("visualization_type", { length: 50 }).notNull(), // 'table', 'chart', 'graph'
  position: json("position").notNull(), // {x: number, y: number}
  size: json("size").notNull(), // {width: number, height: number}
  config: json("config").notNull(),
  refreshInterval: integer("refresh_interval").default(60), // seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: json("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ldapSettings = pgTable("ldap_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  url: varchar("url", { length: 500 }).notNull().default("ldap://localhost:389"),
  baseDN: varchar("base_dn", { length: 500 }).notNull().default("ou=users,dc=example,dc=com"),
  bindDN: varchar("bind_dn", { length: 500 }),
  bindCredentials: text("bind_credentials"),
  searchFilter: varchar("search_filter", { length: 255 }).notNull().default("(uid={username})"),
  tlsRejectUnauthorized: boolean("tls_reject_unauthorized").notNull().default(false),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mailSettings = pgTable("mail_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  host: varchar("host", { length: 255 }).notNull().default("smtp.gmail.com"),
  port: integer("port").notNull().default(587),
  secure: boolean("secure").notNull().default(false),
  authUser: varchar("auth_user", { length: 255 }).notNull().default(""),
  authPass: text("auth_pass").notNull().default(""),
  fromAddress: varchar("from_address", { length: 255 }).notNull().default(""),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const userRelations = relations(users, ({ many }) => ({
  dashboards: many(dashboards),
  passwordResetTokens: many(passwordResetTokens),
}));

export const dashboardRelations = relations(dashboards, ({ one, many }) => ({
  owner: one(users, {
    fields: [dashboards.ownerId],
    references: [users.id],
  }),
  cards: many(dashboardCards),
}));

export const dataSourceRelations = relations(dataSources, ({ many }) => ({
  cards: many(dashboardCards),
}));

export const dashboardCardRelations = relations(dashboardCards, ({ one }) => ({
  dashboard: one(dashboards, {
    fields: [dashboardCards.dashboardId],
    references: [dashboards.id],
  }),
  dataSource: one(dataSources, {
    fields: [dashboardCards.dataSourceId],
    references: [dataSources.id],
  }),
}));

export const passwordResetTokenRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertDashboardSchema = createInsertSchema(dashboards).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Partial update schema for dashboard updates that allows explicit null for logo removal
export const updateDashboardSchema = insertDashboardSchema.partial().extend({
  logoUrl: z.string().nullable().optional(),
});

export const insertDataSourceSchema = createInsertSchema(dataSources).omit({
  id: true,
  createdAt: true,
});

export const insertDashboardCardSchema = createInsertSchema(dashboardCards).omit({
  id: true,
  createdAt: true,
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

export const insertLdapSettingsSchema = createInsertSchema(ldapSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMailSettingsSchema = createInsertSchema(mailSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Dashboard = typeof dashboards.$inferSelect;
export type InsertDashboard = z.infer<typeof insertDashboardSchema>;
export type DataSource = typeof dataSources.$inferSelect;
export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type DashboardCard = typeof dashboardCards.$inferSelect;
export type InsertDashboardCard = z.infer<typeof insertDashboardCardSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type LdapSettings = typeof ldapSettings.$inferSelect;
export type InsertLdapSettings = z.infer<typeof insertLdapSettingsSchema>;
export type MailSettings = typeof mailSettings.$inferSelect;
export type InsertMailSettings = z.infer<typeof insertMailSettingsSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
