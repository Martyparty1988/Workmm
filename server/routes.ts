import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  insertWorkLogSchema, 
  insertFinanceSchema, 
  insertDebtSchema, 
  insertTimerStateSchema 
} from "@shared/schema";
import { z } from "zod";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

// Helper middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Uživatel není přihlášen" });
};

// Helper for validating request body
function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: Function) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        res.status(400).json({ message: validationError.message });
      } else {
        res.status(400).json({ message: "Neplatná data" });
      }
    }
  };
}

// Helper for calculating deduction based on person
function calculateDeduction(earnings: number, person: string): number {
  const rates = { maru: 1/3, marty: 0.5 };
  const rate = rates[person as keyof typeof rates] || 0;
  return Math.round(earnings * rate);
}

// Helper for processing income (CZK incomes should be offset by daily earnings)
async function processIncome(income: any, familyId: string): Promise<any> {
  if (income.currency !== "CZK") {
    return { ...income, offsetAmount: 0, finalAmount: income.amount };
  }
  
  const todayEarnings = await storage.getTodayEarnings(familyId, income.date);
  const offsetAmount = Math.min(income.amount, todayEarnings);
  
  return { 
    ...income, 
    offsetAmount, 
    finalAmount: income.amount - offsetAmount 
  };
}

// Helper to handle monthly expenses (rent and debt payments)
async function handleMonthlyExpenses(familyId: string): Promise<void> {
  const today = new Date();
  
  // Add monthly rent on 1st day of month
  if (today.getDate() === 1) {
    await storage.createFinance({
      familyId,
      type: "expense",
      account: "shared",
      amount: 24500,
      currency: "CZK",
      offsetAmount: 0,
      finalAmount: 24500,
      category: "Bydlení",
      description: "Nájem",
      date: today,
    });
  }

  // Check shared balance and pay debts by priority
  const sharedBalance = await storage.getSharedBalance(familyId);
  if (sharedBalance > 0) {
    const debts = await storage.getActiveDebts(familyId);
    let remainingBalance = sharedBalance;
    
    for (const debt of debts) {
      if (remainingBalance <= 0) break;
      
      const payment = Math.min(remainingBalance, debt.remainingAmount);
      await storage.addDebtPayment(debt.id, payment);
      
      // Record payment as expense
      await storage.createFinance({
        familyId,
        type: "expense",
        account: "shared",
        amount: payment,
        currency: debt.currency,
        offsetAmount: 0,
        finalAmount: payment,
        category: "Dluhy",
        description: `Splátka: ${debt.creditor}`,
        date: today,
      });
      
      remainingBalance -= payment;
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  const httpServer = createServer(app);
  
  // Setup WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Keep track of connected clients by family ID
  const clients = new Map<string, Set<WebSocket>>();
  
  wss.on('connection', (ws: WebSocket, req) => {
    // WebSocket will get familyId from authenticated user later
    let familyId: string | null = null;
    
    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        
        // Handle authentication message to associate WebSocket with familyId
        if (data.type === 'auth' && data.familyId) {
          familyId = data.familyId;
          
          // Add client to the family group
          if (!clients.has(familyId)) {
            clients.set(familyId, new Set());
          }
          clients.get(familyId)?.add(ws);
          
          // Send confirmation
          ws.send(JSON.stringify({ type: 'auth', success: true }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      // Remove client from family group when disconnected
      if (familyId && clients.has(familyId)) {
        clients.get(familyId)?.delete(ws);
        if (clients.get(familyId)?.size === 0) {
          clients.delete(familyId);
        }
      }
    });
  });
  
  // Helper function to broadcast updates to family members
  function broadcastToFamily(familyId: string, data: any) {
    if (clients.has(familyId)) {
      const familyClients = clients.get(familyId)!;
      const message = JSON.stringify(data);
      
      for (const client of familyClients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    }
  }
  
  // Work Logs API routes
  app.get('/api/work-logs', isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const workLogs = await storage.getWorkLogs(user.familyId);
      res.json(workLogs);
    } catch (error) {
      res.status(500).json({ message: "Chyba při načítání záznamů" });
    }
  });
  
  app.post('/api/work-logs', isAuthenticated, validateBody(insertWorkLogSchema), async (req, res) => {
    try {
      const user = req.user!;
      const workLog = req.body;
      
      // Calculate earnings and deduction
      const workedHours = workLog.workedMinutes / 60;
      const earnings = Math.round(workedHours * workLog.hourlyRate);
      const deduction = calculateDeduction(earnings, workLog.person);
      
      const newWorkLog = await storage.createWorkLog({
        ...workLog,
        familyId: user.familyId,
        earnings,
        deduction
      });
      
      // Add deduction to shared account as income
      if (deduction > 0) {
        await storage.createFinance({
          familyId: user.familyId,
          type: "income",
          account: "shared",
          amount: deduction,
          currency: "CZK",
          offsetAmount: 0,
          finalAmount: deduction,
          category: "Srážky z výdělku",
          description: `Srážka: ${workLog.person}`,
          date: workLog.date,
        });
      }
      
      // Broadcast update to all family members
      broadcastToFamily(user.familyId, {
        type: 'workLog',
        action: 'created',
        data: newWorkLog
      });
      
      res.status(201).json(newWorkLog);
    } catch (error) {
      res.status(500).json({ message: "Chyba při vytváření záznamu" });
    }
  });
  
  app.put('/api/work-logs/:id', isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const id = parseInt(req.params.id);
      const workLog = req.body;
      
      // Calculate new earnings and deduction if worklog duration changed
      if (workLog.workedMinutes !== undefined) {
        const workedHours = workLog.workedMinutes / 60;
        workLog.earnings = Math.round(workedHours * (workLog.hourlyRate || 0));
        workLog.deduction = calculateDeduction(workLog.earnings, workLog.person || "");
      }
      
      const updatedWorkLog = await storage.updateWorkLog(id, workLog);
      
      // Broadcast update to all family members
      broadcastToFamily(user.familyId, {
        type: 'workLog',
        action: 'updated',
        data: updatedWorkLog
      });
      
      res.json(updatedWorkLog);
    } catch (error) {
      res.status(500).json({ message: "Chyba při aktualizaci záznamu" });
    }
  });
  
  app.delete('/api/work-logs/:id', isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const id = parseInt(req.params.id);
      
      await storage.deleteWorkLog(id);
      
      // Broadcast update to all family members
      broadcastToFamily(user.familyId, {
        type: 'workLog',
        action: 'deleted',
        id
      });
      
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Chyba při mazání záznamu" });
    }
  });
  
  // Finance API routes
  app.get('/api/finances', isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const finances = await storage.getFinances(user.familyId);
      res.json(finances);
    } catch (error) {
      res.status(500).json({ message: "Chyba při načítání financí" });
    }
  });
  
  app.post('/api/finances', isAuthenticated, validateBody(insertFinanceSchema), async (req, res) => {
    try {
      const user = req.user!;
      let finance = req.body;
      
      // Process income (offset CZK income by daily earnings)
      if (finance.type === "income" && finance.currency === "CZK") {
        finance = await processIncome(finance, user.familyId);
      }
      
      const newFinance = await storage.createFinance({
        ...finance,
        familyId: user.familyId
      });
      
      // Check for monthly expenses and debt payments
      await handleMonthlyExpenses(user.familyId);
      
      // Broadcast update to all family members
      broadcastToFamily(user.familyId, {
        type: 'finance',
        action: 'created',
        data: newFinance
      });
      
      res.status(201).json(newFinance);
    } catch (error) {
      res.status(500).json({ message: "Chyba při vytváření záznamu" });
    }
  });
  
  app.get('/api/finances/balance', isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const sharedBalance = await storage.getSharedBalance(user.familyId);
      res.json({ balance: sharedBalance });
    } catch (error) {
      res.status(500).json({ message: "Chyba při načítání zůstatku" });
    }
  });
  
  // Debt API routes
  app.get('/api/debts', isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const debts = await storage.getDebts(user.familyId);
      res.json(debts);
    } catch (error) {
      res.status(500).json({ message: "Chyba při načítání dluhů" });
    }
  });
  
  app.post('/api/debts', isAuthenticated, validateBody(insertDebtSchema), async (req, res) => {
    try {
      const user = req.user!;
      const debt = req.body;
      
      const newDebt = await storage.createDebt({
        ...debt,
        familyId: user.familyId
      });
      
      // Broadcast update to all family members
      broadcastToFamily(user.familyId, {
        type: 'debt',
        action: 'created',
        data: newDebt
      });
      
      res.status(201).json(newDebt);
    } catch (error) {
      res.status(500).json({ message: "Chyba při vytváření dluhu" });
    }
  });
  
  app.put('/api/debts/:id', isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const id = parseInt(req.params.id);
      const debt = req.body;
      
      const updatedDebt = await storage.updateDebt(id, debt);
      
      // Broadcast update to all family members
      broadcastToFamily(user.familyId, {
        type: 'debt',
        action: 'updated',
        data: updatedDebt
      });
      
      res.json(updatedDebt);
    } catch (error) {
      res.status(500).json({ message: "Chyba při aktualizaci dluhu" });
    }
  });
  
  app.post('/api/debts/:id/payment', isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const id = parseInt(req.params.id);
      const { amount } = req.body;
      
      if (!amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({ message: "Neplatná částka" });
      }
      
      await storage.addDebtPayment(id, amount);
      
      // Record payment as expense
      const debt = await storage.getDebts(user.familyId).then(
        debts => debts.find(d => d.id === id)
      );
      
      if (debt) {
        await storage.createFinance({
          familyId: user.familyId,
          type: "expense",
          account: "shared",
          amount,
          currency: debt.currency,
          offsetAmount: 0,
          finalAmount: amount,
          category: "Dluhy",
          description: `Splátka: ${debt.creditor}`,
          date: new Date(),
        });
      }
      
      // Get updated debt to broadcast
      const updatedDebt = await storage.getDebts(user.familyId).then(
        debts => debts.find(d => d.id === id)
      );
      
      // Broadcast update to all family members
      broadcastToFamily(user.familyId, {
        type: 'debt',
        action: 'updated',
        data: updatedDebt
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Chyba při zpracování platby" });
    }
  });
  
  // Timer API routes
  app.get('/api/timer/:person', isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const person = req.params.person;
      
      if (person !== 'maru' && person !== 'marty') {
        return res.status(400).json({ message: "Neplatná osoba" });
      }
      
      const timerState = await storage.getTimerState(user.familyId, person);
      res.json(timerState || { isRunning: false });
    } catch (error) {
      res.status(500).json({ message: "Chyba při načítání stavu časovače" });
    }
  });
  
  app.post('/api/timer/:person', isAuthenticated, validateBody(insertTimerStateSchema), async (req, res) => {
    try {
      const user = req.user!;
      const person = req.params.person;
      const { isRunning, startTime, activity } = req.body;
      
      if (person !== 'maru' && person !== 'marty') {
        return res.status(400).json({ message: "Neplatná osoba" });
      }
      
      // Check if timer state exists for this person
      const existingTimer = await storage.getTimerState(user.familyId, person);
      
      let timerState;
      if (existingTimer) {
        // Update existing timer
        timerState = await storage.updateTimerState(existingTimer.id, {
          isRunning,
          startTime,
          activity
        });
      } else {
        // Create new timer
        timerState = await storage.createTimerState({
          familyId: user.familyId,
          person,
          isRunning,
          startTime,
          activity
        });
      }
      
      // Broadcast update to all family members
      broadcastToFamily(user.familyId, {
        type: 'timer',
        action: 'updated',
        data: timerState
      });
      
      res.json(timerState);
    } catch (error) {
      res.status(500).json({ message: "Chyba při aktualizaci časovače" });
    }
  });
  
  // Stop timer and create work log
  app.post('/api/timer/:person/stop', isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const person = req.params.person;
      const { activity } = req.body;
      
      if (person !== 'maru' && person !== 'marty') {
        return res.status(400).json({ message: "Neplatná osoba" });
      }
      
      // Get current timer state
      const timerState = await storage.getTimerState(user.familyId, person);
      
      if (!timerState || !timerState.isRunning || !timerState.startTime) {
        return res.status(400).json({ message: "Časovač neběží" });
      }
      
      // Calculate worked time
      const startTime = new Date(timerState.startTime);
      const endTime = new Date();
      const workedMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
      
      if (workedMinutes <= 0) {
        return res.status(400).json({ message: "Neplatný čas práce" });
      }
      
      // Determine hourly rate based on person
      const hourlyRate = person === 'maru' ? 275 : 400;
      
      // Calculate earnings and deduction
      const workedHours = workedMinutes / 60;
      const earnings = Math.round(workedHours * hourlyRate);
      const deduction = calculateDeduction(earnings, person);
      
      // Create work log
      const workLog = await storage.createWorkLog({
        familyId: user.familyId,
        person,
        date: new Date(),
        startTime,
        endTime,
        workedMinutes,
        hourlyRate,
        earnings,
        deduction,
        activity: activity || timerState.activity || 'Práce',
      });
      
      // Add deduction to shared account as income
      if (deduction > 0) {
        await storage.createFinance({
          familyId: user.familyId,
          type: "income",
          account: "shared",
          amount: deduction,
          currency: "CZK",
          offsetAmount: 0,
          finalAmount: deduction,
          category: "Srážky z výdělku",
          description: `Srážka: ${person}`,
          date: new Date(),
        });
      }
      
      // Stop the timer
      await storage.updateTimerState(timerState.id, {
        isRunning: false,
        startTime: null,
      });
      
      // Broadcast updates to all family members
      broadcastToFamily(user.familyId, {
        type: 'workLog',
        action: 'created',
        data: workLog
      });
      
      broadcastToFamily(user.familyId, {
        type: 'timer',
        action: 'stopped',
        person
      });
      
      res.json({ workLog });
    } catch (error) {
      res.status(500).json({ message: "Chyba při zastavování časovače" });
    }
  });
  
  return httpServer;
}
