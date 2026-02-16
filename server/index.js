/**
 * Real-Time Image Sync POC - Backend
 * - Express API (mock auth, client/evaluator registry)
 * - Socket.io server (real-time + WebRTC signaling)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');

const RECORDINGS_DIR = path.join(__dirname, '..', 'recordings');
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

const PORT = process.env.PORT || 3001;
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Mock auth & registry ---
const USERS = {
  evaluator1: { id: 'evaluator1', name: 'Evaluator One', role: 'evaluator', password: 'eval1' },
  evaluator2: { id: 'evaluator2', name: 'Evaluator Two', role: 'evaluator', password: 'eval2' },
  client1: { id: 'client1', name: 'Client One', role: 'client', password: 'client1' },
  client2: { id: 'client2', name: 'Client Two', role: 'client', password: 'client2' },
};

const socketToUser = new Map(); // socketId -> { userId, role, package }
const onlineClients = new Set(); // userId (clients only, Socket.io)
const onlineEvaluators = new Set(); // userId (evaluators only)
const evaluatorSessions = new Map(); // evaluatorId -> { clientId, sessionId, clientSocketId }
// HTTP presence for MQTT (and any) clients that don't use Socket.io
const presenceMap = new Map(); // userId -> { package, lastSeen }
const PRESENCE_TTL_MS = 35000;
// One segment per image per client: key = evaluatorId_clientId_imageIndex (avoids duplicates/data loss)
const storedSegmentsByKey = new Map(); // key -> { sessionId, evaluatorId, clientId, imageIndex, signedUrl, audioBase64, receivedAt }

// --- Auth ---
app.post('/api/auth/login', (req, res) => {
  const { userId, password } = req.body || {};
  const user = USERS[userId];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ user: { id: user.id, name: user.name, role: user.role }, token: `mock-${user.id}` });
});

// Clients report presence (used by MQTT clients that don't have a Socket.io connection)
app.post('/api/presence', (req, res) => {
  const { userId, package: pkg } = req.body || {};
  if (!userId || !pkg) return res.status(400).json({ error: 'userId and package required' });
  const user = USERS[userId];
  if (!user || user.role !== 'client') return res.status(400).json({ error: 'Invalid client' });
  presenceMap.set(userId, { package: pkg, lastSeen: Date.now() });
  res.json({ ok: true });
});

// Client submits segment (previous image ref + audio) when evaluator sends next image. One segment per image per client.
app.post('/api/session/segment', (req, res) => {
  const { sessionId, evaluatorId, clientId, imageIndex, signedUrl, audioBase64 } = req.body || {};
  if (signedUrl == null && !audioBase64) {
    return res.status(400).json({ error: 'signedUrl or audioBase64 required' });
  }
  const segment = {
    sessionId: sessionId || null,
    evaluatorId: evaluatorId || null,
    clientId: clientId || null,
    imageIndex: imageIndex != null ? imageIndex : null,
    signedUrl: signedUrl || null,
    audioBase64: audioBase64 || null,
    receivedAt: Date.now(),
  };
  const key = `${segment.evaluatorId ?? 'e'}_${segment.clientId ?? 'c'}_${segment.imageIndex}`;
  const isUpdate = storedSegmentsByKey.has(key);
  storedSegmentsByKey.set(key, segment);

  if (segment.audioBase64) {
    try {
      const ext = 'm4a';
      const filename = `segment_image_${segment.imageIndex}_${segment.clientId || 'unknown'}.${ext}`;
      const filePath = path.join(RECORDINGS_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(segment.audioBase64, 'base64'));
      console.log('[segment] saved audio to', filename, isUpdate ? '(overwrite)' : '');
    } catch (err) {
      console.warn('[segment] failed to save audio file', err.message);
    }
  }

  console.log('[segment]', {
    key,
    imageIndex: segment.imageIndex,
    signedUrl: segment.signedUrl ? `${segment.signedUrl.slice(0, 40)}...` : null,
    hasAudio: !!segment.audioBase64,
    clientId: segment.clientId,
    evaluatorId: segment.evaluatorId,
    ...(isUpdate && { overwrote: true }),
  });
  res.json({ ok: true, segmentId: key });
});

// Optional: list stored segments (one per image per client; for debugging / POC)
app.get('/api/session/segments', (req, res) => {
  const segments = Array.from(storedSegmentsByKey.entries()).map(([key, s]) => ({
    id: key,
    sessionId: s.sessionId,
    evaluatorId: s.evaluatorId,
    clientId: s.clientId,
    imageIndex: s.imageIndex,
    signedUrl: s.signedUrl,
    hasAudio: !!s.audioBase64,
    receivedAt: s.receivedAt,
  }));
  res.json({ segments });
});

// Only return clients that are online AND using the SAME protocol (package) as requested.
// Evaluator must pass ?package=socketio|mqtt|webrtc - only those clients are returned.
app.get('/api/clients', (req, res) => {
  const rawPkg = req.query.package;
  if (rawPkg == null || rawPkg === '') {
    return res.json({ clients: [] });
  }
  const normalizedPkg = normalizePackage(rawPkg);
  if (!VALID_PACKAGES.includes(normalizedPkg)) {
    return res.json({ clients: [] });
  }
  const now = Date.now();
  const list = [];
  // From Socket.io: only clients that registered with this exact package
  const sockets = io.sockets.sockets ? Array.from(io.sockets.sockets.values()) : [];
  for (const socket of sockets) {
    if (socket.role !== 'client') continue;
    if (normalizePackage(socket.package) !== normalizedPkg) continue;
    const u = USERS[socket.userId];
    list.push({ id: socket.userId, name: u?.name || socket.userId, online: true });
  }
  // From HTTP presence: only same package and seen recently (MQTT clients)
  const seen = new Set(list.map((c) => c.id));
  for (const [userId, entry] of presenceMap.entries()) {
    if (seen.has(userId)) continue;
    if (normalizePackage(entry.package) !== normalizedPkg || now - entry.lastSeen > PRESENCE_TTL_MS) continue;
    const u = USERS[userId];
    if (u && u.role === 'client') {
      list.push({ id: userId, name: u.name || userId, online: true });
      seen.add(userId);
    }
  }
  res.json({ clients: list });
});

const VALID_PACKAGES = ['socketio', 'mqtt', 'webrtc'];
function normalizePackage(pkg) {
  const s = String(pkg || 'socketio').toLowerCase();
  return VALID_PACKAGES.includes(s) ? s : 'socketio';
}

// --- Socket.io events ---
io.on('connection', (socket) => {
  socket.on('register', (payload) => {
    const { userId, role, package: pkg } = payload || {};
    if (!userId || !role) return;
    socket.userId = userId;
    socket.role = role;
    socket.package = normalizePackage(pkg);
    socketToUser.set(socket.id, { userId, role, package: socket.package });
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
      (s) => s.userId === clientId && s.role === 'client' && s.package === socket.package
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

  // Evaluator: send image update (Socket.io path; WebRTC sends image over data channel)
  socket.on('image_update', (payload) => {
    const { imageIndex, imageUrl, signedUrl, sentAt } = payload || {};
    const session = evaluatorSessions.get(socket.userId);
    if (!session?.clientSocketId) return;
    io.to(session.clientSocketId).emit('image_update', {
      imageIndex,
      imageUrl,
      signedUrl: signedUrl || undefined,
      sentAt: sentAt || Date.now(),
    });
  });

  // Client: latency ack (client sends after receiving image_update; server forwards to evaluator)
  socket.on('image_ack', (payload) => {
    const { sentAt, receivedAt } = payload || {};
    if (sentAt == null || receivedAt == null) return;
    const clientId = socket.userId;
    const sockets = Array.from(io.sockets.sockets.values());
    for (const [evaluatorId, session] of evaluatorSessions.entries()) {
      if (session.clientId === clientId) {
        const evaluatorSocket = sockets.find((s) => s.userId === evaluatorId && s.role === 'evaluator');
        if (evaluatorSocket) evaluatorSocket.emit('image_ack', { sentAt, receivedAt });
        break;
      }
    }
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
