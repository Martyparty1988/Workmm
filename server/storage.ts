import { 
  users, 
  workLogs, 
  finances, 
  debts, 
  timerStates,
  type User, 
  type InsertUser, 
  type WorkLog, 
  type InsertWorkLog,
  type Finance,
  type InsertFinance,
  type Debt,
  type InsertDebt,
  type TimerState,
  type InsertTimerState
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

// Define the storage interface
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Work log methods
  getWorkLogs(familyId: string): Promise<WorkLog[]>;
  getWorkLogsByPerson(familyId: string, person: string): Promise<WorkLog[]>;
  getWorkLogsByDate(familyId: string, date: Date): Promise<WorkLog[]>;
  createWorkLog(workLog: InsertWorkLog): Promise<WorkLog>;
  updateWorkLog(id: number, workLog: Partial<InsertWorkLog>): Promise<WorkLog>;
  deleteWorkLog(id: number): Promise<void>;
  getTodayEarnings(familyId: string, date: Date): Promise<number>;
  
  // Finance methods
  getFinances(familyId: string): Promise<Finance[]>;
  getFinancesByAccount(familyId: string, account: string): Promise<Finance[]>;
  createFinance(finance: InsertFinance): Promise<Finance>;
  getSharedBalance(familyId: string): Promise<number>;
  
  // Debt methods
  getDebts(familyId: string): Promise<Debt[]>;
  getActiveDebts(familyId: string): Promise<Debt[]>;
  createDebt(debt: InsertDebt): Promise<Debt>;
  updateDebt(id: number, debt: Partial<InsertDebt>): Promise<Debt>;
  addDebtPayment(id: number, amount: number): Promise<void>;
  
  // Timer state methods
  getTimerState(familyId: string, person: string): Promise<TimerState | undefined>;
  createTimerState(timerState: InsertTimerState): Promise<TimerState>;
  updateTimerState(id: number, timerState: Partial<InsertTimerState>): Promise<TimerState>;
  
  // Session store
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // If no familyId is provided, generate a random one
    const userWithFamily = insertUser.familyId
      ? insertUser
      : { ...insertUser, familyId: randomUUID() };
      
    const result = await db.insert(users).values(userWithFamily).returning();
    return result[0];
  }

  // Work log methods
  async getWorkLogs(familyId: string): Promise<WorkLog[]> {
    return await db.select()
      .from(workLogs)
      .where(eq(workLogs.familyId, familyId))
      .orderBy(desc(workLogs.date));
  }

  async getWorkLogsByPerson(familyId: string, person: string): Promise<WorkLog[]> {
    return await db.select()
      .from(workLogs)
      .where(and(
        eq(workLogs.familyId, familyId),
        eq(workLogs.person, person as any)
      ))
      .orderBy(desc(workLogs.date));
  }

  async getWorkLogsByDate(familyId: string, date: Date): Promise<WorkLog[]> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    
    return await db.select()
      .from(workLogs)
      .where(and(
        eq(workLogs.familyId, familyId),
        gte(workLogs.date, start),
        lte(workLogs.date, end)
      ))
      .orderBy(desc(workLogs.date));
  }

  async createWorkLog(insertWorkLog: InsertWorkLog): Promise<WorkLog> {
    const result = await db.insert(workLogs).values(insertWorkLog).returning();
    return result[0];
  }

  async updateWorkLog(id: number, workLog: Partial<InsertWorkLog>): Promise<WorkLog> {
    const result = await db.update(workLogs)
      .set({ ...workLog, updatedAt: new Date() })
      .where(eq(workLogs.id, id))
      .returning();
      
    if (result.length === 0) {
      throw new Error("WorkLog not found");
    }
    
    return result[0];
  }

  async deleteWorkLog(id: number): Promise<void> {
    const result = await db.delete(workLogs).where(eq(workLogs.id, id)).returning();
    
    if (result.length === 0) {
      throw new Error("WorkLog not found");
    }
  }

  async getTodayEarnings(familyId: string, date: Date): Promise<number> {
    const logs = await this.getWorkLogsByDate(familyId, date);
    return logs.reduce((sum, log) => sum + (log.earnings || 0), 0);
  }

  // Finance methods
  async getFinances(familyId: string): Promise<Finance[]> {
    return await db.select()
      .from(finances)
      .where(eq(finances.familyId, familyId))
      .orderBy(desc(finances.date));
  }

  async getFinancesByAccount(familyId: string, account: string): Promise<Finance[]> {
    return await db.select()
      .from(finances)
      .where(and(
        eq(finances.familyId, familyId),
        eq(finances.account, account as any)
      ))
      .orderBy(desc(finances.date));
  }

  async createFinance(insertFinance: InsertFinance): Promise<Finance> {
    // Calculate finalAmount if not provided
    const finalAmount = insertFinance.finalAmount ?? 
      (insertFinance.amount - (insertFinance.offsetAmount || 0));
    
    const financeWithFinalAmount = {
      ...insertFinance,
      finalAmount
    };
    
    const result = await db.insert(finances).values(financeWithFinalAmount).returning();
    return result[0];
  }

  async getSharedBalance(familyId: string): Promise<number> {
    const financesList = await this.getFinancesByAccount(familyId, "shared");
    
    return financesList.reduce((balance, finance) => {
      if (finance.type === "income") {
        return balance + finance.amount;
      } else {
        return balance - finance.amount;
      }
    }, 0);
  }

  // Debt methods
  async getDebts(familyId: string): Promise<Debt[]> {
    return await db.select()
      .from(debts)
      .where(eq(debts.familyId, familyId))
      .orderBy(asc(debts.priority));
  }

  async getActiveDebts(familyId: string): Promise<Debt[]> {
    return await db.select()
      .from(debts)
      .where(and(
        eq(debts.familyId, familyId),
        gte(debts.remainingAmount, 1) // Greater than or equal to 1
      ))
      .orderBy(asc(debts.priority));
  }

  async createDebt(insertDebt: InsertDebt): Promise<Debt> {
    const result = await db.insert(debts).values(insertDebt).returning();
    return result[0];
  }

  async updateDebt(id: number, debt: Partial<InsertDebt>): Promise<Debt> {
    const result = await db.update(debts)
      .set(debt)
      .where(eq(debts.id, id))
      .returning();
      
    if (result.length === 0) {
      throw new Error("Debt not found");
    }
    
    return result[0];
  }

  async addDebtPayment(id: number, amount: number): Promise<void> {
    // Get the current debt from the database
    const debtResult = await db.select().from(debts).where(eq(debts.id, id));
    if (debtResult.length === 0) {
      throw new Error("Debt not found");
    }
    
    const debt = debtResult[0];
    
    // Add payment to history
    const payment = { 
      amount, 
      date: new Date() 
    };
    
    const payments = Array.isArray(debt.payments) 
      ? [...debt.payments, payment] 
      : [payment];
    
    // Update remaining amount
    const remainingAmount = Math.max(0, debt.remainingAmount - amount);
    
    // Update debt
    await db.update(debts)
      .set({
        remainingAmount,
        payments
      })
      .where(eq(debts.id, id));
  }

  // Timer state methods
  async getTimerState(familyId: string, person: string): Promise<TimerState | undefined> {
    const result = await db.select()
      .from(timerStates)
      .where(and(
        eq(timerStates.familyId, familyId),
        eq(timerStates.person, person as any)
      ));
      
    return result[0];
  }

  async createTimerState(insertTimerState: InsertTimerState): Promise<TimerState> {
    const result = await db.insert(timerStates).values(insertTimerState).returning();
    return result[0];
  }

  async updateTimerState(id: number, timerState: Partial<InsertTimerState>): Promise<TimerState> {
    const result = await db.update(timerStates)
      .set({ ...timerState, updatedAt: new Date() })
      .where(eq(timerStates.id, id))
      .returning();
      
    if (result.length === 0) {
      throw new Error("TimerState not found");
    }
    
    return result[0];
  }
}

export const storage = new DatabaseStorage();
