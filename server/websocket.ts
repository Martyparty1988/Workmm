import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage';

interface SocketConnection {
  socket: WebSocket;
  userId: number;
  familyId: string;
}

interface SocketMessage {
  type: string;
  data: any;
}

export function setupWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  // Track all active connections
  const connections: SocketConnection[] = [];
  
  wss.on('connection', (socket: WebSocket) => {
    console.log('WebSocket connection established');
    
    // Unauthenticated socket initially
    let userId: number | null = null;
    let familyId: string | null = null;
    
    socket.on('message', async (message: string) => {
      try {
        const parsedMessage: SocketMessage = JSON.parse(message);
        
        // Handle authentication message
        if (parsedMessage.type === 'AUTH') {
          userId = parsedMessage.data.userId;
          familyId = parsedMessage.data.familyId;
          
          // Register this connection
          connections.push({
            socket,
            userId,
            familyId
          });
          
          console.log(`WebSocket authenticated for user ${userId}, family ${familyId}`);
          
          // Send initial timer state if available
          if (userId) {
            const timerState = await storage.getTimerState(userId);
            if (timerState) {
              socket.send(JSON.stringify({
                type: 'TIMER_UPDATE',
                data: timerState
              }));
            }
          }
        }
        
        // Handle other message types
        // Timer updates from client
        if (parsedMessage.type === 'TIMER_UPDATE' && userId && familyId) {
          // Broadcast to all family members except sender
          broadcastToFamily(familyId, userId, {
            type: 'TIMER_UPDATE',
            data: parsedMessage.data
          });
        }
        
        // Work log updates
        if (parsedMessage.type === 'WORKLOG_UPDATE' && familyId) {
          // Broadcast to all family members
          broadcastToFamily(familyId, null, {
            type: 'WORKLOG_UPDATE',
            data: parsedMessage.data
          });
        }
        
        // Finance updates
        if (parsedMessage.type === 'FINANCE_UPDATE' && familyId) {
          // Broadcast to all family members
          broadcastToFamily(familyId, null, {
            type: 'FINANCE_UPDATE',
            data: parsedMessage.data
          });
        }
        
        // Debt updates
        if (parsedMessage.type === 'DEBT_UPDATE' && familyId) {
          // Broadcast to all family members
          broadcastToFamily(familyId, null, {
            type: 'DEBT_UPDATE',
            data: parsedMessage.data
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    socket.on('close', () => {
      console.log('WebSocket connection closed');
      
      // Remove from connections
      const index = connections.findIndex(conn => 
        conn.socket === socket && conn.userId === userId
      );
      
      if (index !== -1) {
        connections.splice(index, 1);
      }
    });
    
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
  
  // Function to broadcast messages to all family members
  function broadcastToFamily(
    targetFamilyId: string,
    excludeUserId: number | null,
    message: SocketMessage
  ) {
    const familyConnections = connections.filter(
      conn => conn.familyId === targetFamilyId && 
      (excludeUserId === null || conn.userId !== excludeUserId)
    );
    
    familyConnections.forEach(conn => {
      if (conn.socket.readyState === WebSocket.OPEN) {
        conn.socket.send(JSON.stringify(message));
      }
    });
  }
  
  // Utility to broadcast timer updates to family members
  async function notifyTimerUpdate(userId: number, timerState: any) {
    const user = await storage.getUser(userId);
    if (user) {
      broadcastToFamily(user.familyId, userId, {
        type: 'TIMER_UPDATE',
        data: timerState
      });
    }
  }
  
  // Utility to broadcast work log updates
  async function notifyWorkLogUpdate(familyId: string) {
    const workLogs = await storage.getRecentWorkLogs(familyId, 5);
    broadcastToFamily(familyId, null, {
      type: 'WORKLOG_UPDATE',
      data: workLogs
    });
  }
  
  // Utility to broadcast finance updates
  async function notifyFinanceUpdate(familyId: string) {
    const summary = await storage.getFinanceSummary(familyId);
    broadcastToFamily(familyId, null, {
      type: 'FINANCE_UPDATE',
      data: summary
    });
  }
  
  // Utility to broadcast debt updates
  async function notifyDebtUpdate(familyId: string) {
    const debts = await storage.getDebts(familyId);
    broadcastToFamily(familyId, null, {
      type: 'DEBT_UPDATE',
      data: debts
    });
  }
  
  // Export notification utilities
  return {
    notifyTimerUpdate,
    notifyWorkLogUpdate,
    notifyFinanceUpdate,
    notifyDebtUpdate
  };
}
