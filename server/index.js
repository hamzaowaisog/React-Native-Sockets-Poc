/**
 * Real-Time Image Sync POC - Backend
 * - Express API (mock auth, client/evaluator registry)
 * - Socket.io server (real-time + WebRTC signaling)
 */

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');

const PORT = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors());
app.use(express.json());

// --- Mock auth & registry ---
const USERS = {
  evaluator1: { id: 'evaluator1', name: 'Evaluator One', role: 'evaluator', password: 'eval1' },
  evaluator2: { id: 'evaluator2', name: 'Evaluator Two', role: 'evaluator', password: 'eval2' },
  client1: { id: 'client1', name: 'Client One', role: 'client', password: 'client1' },
  client2: { id: 'client2', name: 'Client Two', role: 'client', password: 'client2' },
};

const socketToUser = new Map(); // socketId -> { userId, role }
const onlineClients = new Set(); // userId (clients only)
const onlineEvaluators = new Set(); // userId (evaluators only)
const evaluatorSessions = new Map(); // evaluatorId -> { clientId, sessionId, clientSocketId }

// --- Auth ---
app.post('/api/auth/login', (req, res) => {
  const { userId, password } = req.body || {};
  const user = USERS[userId];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ user: { id: user.id, name: user.name, role: user.role }, token: `mock-${user.id}` });
});

app.get('/api/clients', (_req, res) => {
  const list = Array.from(onlineClients).map((id) => {
    const u = USERS[id];
    return { id: u?.id || id, name: u?.name || id, online: true };
  });
  res.json({ clients: list });
});

// --- Socket.io events ---
io.on('connection', (socket) => {
  socket.on('register', (payload) => {
    const { userId, role } = payload || {};
    if (!userId || !role) return;
    socket.userId = userId;
    socket.role = role;
    socketToUser.set(socket.id, { userId, role });
    if (role === 'client') {
      onlineClients.add(userId);
      io.emit('clients_updated', { clients: Array.from(onlineClients) });
    } else if (role === 'evaluator') {
      onlineEvaluators.add(userId);
    }
  });

  // Evaluator: start session with client
  socket.on('start_session', (payload) => {
    const clientId = payload?.clientId;
    const evaluatorId = socket.userId;
    if (!clientId || !evaluatorId) return;
    const sessionId = `sess_${evaluatorId}_${clientId}_${Date.now()}`;
    const clientSockets = Array.from(io.sockets.sockets.values()).filter(
      (s) => s.userId === clientId && s.role === 'client'
    );
    const clientSocketId = clientSockets[0]?.id || null;
    evaluatorSessions.set(evaluatorId, { clientId, sessionId, clientSocketId });
    socket.join(sessionId);
    if (clientSocketId) {
      io.to(clientSocketId).emit('session_started', { sessionId, evaluatorId, evaluatorName: USERS[evaluatorId]?.name });
      io.sockets.sockets.get(clientSocketId)?.join(sessionId);
    }
    socket.emit('session_started', { sessionId, clientId });
  });

  // Evaluator: send image update
  socket.on('image_update', (payload) => {
    const { imageIndex, imageUrl, sentAt } = payload || {};
    const session = evaluatorSessions.get(socket.userId);
    if (!session?.clientSocketId) return;
    io.to(session.clientSocketId).emit('image_update', {
      imageIndex,
      imageUrl,
      sentAt: sentAt || Date.now(),
    });
  });

  // Evaluator: end session
  socket.on('end_session', () => {
    const session = evaluatorSessions.get(socket.userId);
    if (session?.clientSocketId) {
      io.to(session.clientSocketId).emit('session_ended', {});
      io.sockets.sockets.get(session.clientSocketId)?.leave(session.sessionId);
    }
    socket.leave(session?.sessionId || '');
    evaluatorSessions.delete(socket.userId);
    socket.emit('session_ended', {});
  });

  // WebRTC signaling (pass-through)
  socket.on('webrtc_signal', (payload) => {
    const { targetUserId, signal } = payload || {};
    const targetSockets = Array.from(io.sockets.sockets.values()).filter(
      (s) => s.userId === targetUserId
    );
    targetSockets.forEach((s) => s.emit('webrtc_signal', { fromUserId: socket.userId, signal }));
  });

  socket.on('disconnect', () => {
    const info = socketToUser.get(socket.id);
    if (info) {
      if (info.role === 'client') {
        onlineClients.delete(info.userId);
        io.emit('clients_updated', { clients: Array.from(onlineClients) });
        // End any session this client was in
        for (const [evalId, sess] of evaluatorSessions.entries()) {
          if (sess.clientId === info.userId) {
            evaluatorSessions.delete(evalId);
            io.to(sess.clientSocketId).emit('session_ended', {});
            break;
          }
        }
      } else if (info.role === 'evaluator') {
        const session = evaluatorSessions.get(info.userId);
        if (session?.clientSocketId) {
          io.to(session.clientSocketId).emit('session_ended', {});
        }
        evaluatorSessions.delete(info.userId);
      }
      socketToUser.delete(socket.id);
    }
    onlineClients.delete(socket.userId);
    onlineEvaluators.delete(socket.userId);
  });
});

server.listen(PORT, () => {
  console.log(`Realtime sync server running on http://localhost:${PORT}`);
});
