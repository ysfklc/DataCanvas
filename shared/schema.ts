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
  lastTestAt: timestamp("last_test_at"),
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

// Relations
export const userRelations = relations(users, ({ many }) => ({
  dashboards: many(dashboards),
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
