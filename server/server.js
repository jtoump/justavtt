/**
 * Simple WebSocket server for multiplayer session management.
 * Run with: node server/server.js
 */

import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces
const wss = new WebSocketServer({ port: PORT, host: HOST });

// Store active sessions
const sessions = new Map();

// Generate simple user IDs
let userIdCounter = 0;
function generateUserId() {
  return `user_${++userIdCounter}`;
}

// Generate session IDs from names (normalized)
function normalizeSessionName(name) {
  return name.toLowerCase().trim().replace(/\s+/g, '-');
}

wss.on('connection', (ws) => {
  const userId = generateUserId();
  ws.userId = userId;
  ws.sessionId = null;

  console.log(`User connected: ${userId}`);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleMessage(ws, message);
    } catch (error) {
      console.error('Failed to parse message:', error);
      sendError(ws, 'Invalid message format');
    }
  });

  ws.on('close', () => {
    console.log(`User disconnected: ${userId}`);
    if (ws.sessionId) {
      leaveSession(ws);
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for ${userId}:`, error);
  });
});

function handleMessage(ws, message) {
  switch (message.type) {
    case 'create_session':
      createSession(ws, message.sessionName, message.state);
      break;

    case 'join_session':
      joinSession(ws, message.sessionName);
      break;

    case 'leave_session':
      leaveSession(ws);
      break;

    case 'state_update':
      broadcastState(ws, message.state);
      break;

    default:
      sendError(ws, `Unknown message type: ${message.type}`);
  }
}

function createSession(ws, sessionName, initialState) {
  if (!sessionName) {
    sendError(ws, 'Session name is required');
    return;
  }

  const sessionId = normalizeSessionName(sessionName);

  if (sessions.has(sessionId)) {
    sendError(ws, 'Session already exists');
    return;
  }

  // Create new session
  const session = {
    id: sessionId,
    name: sessionName,
    state: initialState || { version: 1, objects: [] },
    users: new Set([ws])
  };

  sessions.set(sessionId, session);
  ws.sessionId = sessionId;

  console.log(`Session created: ${sessionId} by ${ws.userId}`);

  send(ws, {
    type: 'session_created',
    sessionId,
    sessionName
  });
}

function joinSession(ws, sessionName) {
  if (!sessionName) {
    sendError(ws, 'Session name is required');
    return;
  }

  const sessionId = normalizeSessionName(sessionName);
  const session = sessions.get(sessionId);

  if (!session) {
    sendError(ws, 'Session not found');
    return;
  }

  // Leave current session if in one
  if (ws.sessionId) {
    leaveSession(ws);
  }

  // Join the session
  session.users.add(ws);
  ws.sessionId = sessionId;

  console.log(`User ${ws.userId} joined session: ${sessionId}`);

  // Send current state to the joining user
  send(ws, {
    type: 'session_joined',
    sessionId,
    sessionName: session.name,
    state: session.state
  });

  // Notify other users
  broadcastToSession(session, {
    type: 'user_joined',
    userId: ws.userId,
    userCount: session.users.size
  }, ws);

  // Send user count update to the joining user
  send(ws, {
    type: 'user_joined',
    userId: ws.userId,
    userCount: session.users.size
  });
}

function leaveSession(ws) {
  const sessionId = ws.sessionId;
  if (!sessionId) return;

  const session = sessions.get(sessionId);
  if (!session) {
    ws.sessionId = null;
    return;
  }

  session.users.delete(ws);
  ws.sessionId = null;

  console.log(`User ${ws.userId} left session: ${sessionId}`);

  if (session.users.size === 0) {
    // Delete empty session
    sessions.delete(sessionId);
    console.log(`Session deleted: ${sessionId} (no users)`);
  } else {
    // Notify remaining users
    broadcastToSession(session, {
      type: 'user_left',
      userId: ws.userId,
      userCount: session.users.size
    });
  }
}

function broadcastState(ws, state) {
  const sessionId = ws.sessionId;
  if (!sessionId) return;

  const session = sessions.get(sessionId);
  if (!session) return;

  // Update stored state
  session.state = state;

  // Broadcast to all other users in the session
  broadcastToSession(session, {
    type: 'state_update',
    state,
    from: ws.userId
  }, ws);
}

function broadcastToSession(session, message, excludeWs = null) {
  for (const client of session.users) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      send(client, message);
    }
  }
}

function send(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function sendError(ws, error) {
  send(ws, {
    type: 'error',
    error
  });
}

console.log(`WebSocket server running on ws://localhost:${PORT}`);
console.log(`Network access: ws://<your-ip>:${PORT}`);
console.log('Press Ctrl+C to stop');
