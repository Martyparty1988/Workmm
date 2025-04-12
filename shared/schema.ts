import { pgTable, text, serial, integer, timestamp, doublePrecision, jsonb, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name", { enum: ["maru", "marty"] }).notNull(),
  familyId: text("family_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Work logs table
export const workLogs = pgTable("work_logs", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  person: text("person", { enum: ["maru", "marty"] }).notNull(),
  date: timestamp("date").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  workedMinutes: integer("worked_minutes").default(0),
  hourlyRate: integer("hourly_rate").notNull(),
  earnings: integer("earnings").default(0),
  deduction: integer("deduction").default(0),
  activity: text("activity").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Finances table
export const finances = pgTable("finances", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  account: text("account", { enum: ["maru", "marty", "shared"] }).notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency", { enum: ["CZK", "EUR", "USD"] }).notNull(),
  offsetAmount: integer("offset_amount").default(0),
  finalAmount: integer("final_amount"),
  category: text("category").notNull(),
  description: text("description"),
  date: timestamp("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Debts table
export const debts = pgTable("debts", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  creditor: text("creditor").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency", { enum: ["CZK", "EUR", "USD"] }).notNull(),
  remainingAmount: integer("remaining_amount").notNull(),
  dueDate: timestamp("due_date"),
  priority: integer("priority").notNull(),
  payments: jsonb("payments").default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Timer state table
export const timerStates = pgTable("timer_states", {
  id: serial("id").primaryKey(),
  familyId: text("family_id").notNull(),
  person: text("person", { enum: ["maru", "marty"] }).notNull(),
  isRunning: boolean("is_running").default(false).notNull(),
  startTime: timestamp("start_time"),
  activity: text("activity"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  familyId: true,
});

export const insertWorkLogSchema = createInsertSchema(workLogs).pick({
  familyId: true,
  person: true,
  date: true,
  startTime: true,
  endTime: true,
  workedMinutes: true,
  hourlyRate: true,
  earnings: true,
  deduction: true,
  activity: true,
});

export const insertFinanceSchema = createInsertSchema(finances).pick({
  familyId: true,
  type: true,
  account: true,
  amount: true,
  currency: true,
  offsetAmount: true,
  finalAmount: true,
  category: true,
  description: true,
  date: true,
});

export const insertDebtSchema = createInsertSchema(debts).pick({
  familyId: true,
  creditor: true,
  amount: true,
  currency: true,
  remainingAmount: true,
  dueDate: true,
  priority: true,
  payments: true,
});

export const insertTimerStateSchema = createInsertSchema(timerStates).pick({
  familyId: true,
  person: true,
  isRunning: true,
  startTime: true,
  activity: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type WorkLog = typeof workLogs.$inferSelect;
export type InsertWorkLog = z.infer<typeof insertWorkLogSchema>;

export type Finance = typeof finances.$inferSelect;
export type InsertFinance = z.infer<typeof insertFinanceSchema>;

export type Debt = typeof debts.$inferSelect;
export type InsertDebt = z.infer<typeof insertDebtSchema>;

export type TimerState = typeof timerStates.$inferSelect;
export type InsertTimerState = z.infer<typeof insertTimerStateSchema>;

// Validation schemas for forms
export const loginSchema = z.object({
  email: z.string().email("Neplatný email"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
});

export const registerSchema = z.object({
  email: z.string().email("Neplatný email"),
  password: z.string().min(6, "Heslo musí mít alespoň 6 znaků"),
  name: z.enum(["maru", "marty"], {
    errorMap: () => ({ message: "Vyberte osobu" }),
  }),
  familyId: z.string().optional(),
});

export type LoginData = z.infer<typeof loginSchema>;
export type RegisterData = z.infer<typeof registerSchema>;
