# Real-Time Data Transport: MQTT, Socket.io & WebRTC

This document explains how each package is used for data traveling in the POC, what is required to use it, web feasibility, pros/cons, configuration, and implementation details.

---

## Table of Contents

1. [Socket.io](#1-socketio)
2. [MQTT](#2-mqtt)
3. [WebRTC](#3-webrtc)
4. [Quick comparison table](#4-quick-comparison-table)

---

## 1. Socket.io

### What it is

**Socket.io** is a **client–server** real-time transport library. It provides a persistent connection (typically over WebSockets with HTTP long-polling fallback) between client and server. All application data travels **via your server**; the server receives messages from one client and can emit to others.

### Data flow

```
Evaluator  ──►  Your Server  ──►  Client
   (emit)         (relay)         (receive)
   ◄──────  image_ack (latency)  ◄──────
```

- Evaluator sends `image_update` (imageIndex, imageUrl, sentAt) to the server.
- Server looks up the client’s socket (from the session) and emits the same payload to that client.
- **All data passes through the server** (no direct peer-to-peer link for this traffic).
- **Latency metrics:** After receiving each image, the client emits `image_ack` with `{ sentAt, receivedAt }`. The server forwards this to the evaluator who has that client in session. The evaluator records latency (receivedAt − sentAt) so the performance panel shows real-time metrics.

### What you need to use it

| Requirement | Details |
|------------|--------|
| **Backend** | A Node.js (or other) server running the **Socket.io server** library. |
| **Client library** | `socket.io-client` on the app (React Native) or `socket.io-client` in the browser. |
| **Network** | Server must be reachable (same host, LAN, or public URL). No special firewall rules beyond normal HTTP/WebSocket. |
| **Port** | One TCP port (e.g. 3001) for HTTP + WebSocket upgrade. |

### Web (browser) feasibility

| Aspect | Support |
|--------|--------|
| **Browser support** | Yes. Socket.io has a **browser client** (`socket.io-client`). Same API as in Node/React Native. |
| **Same codebase** | You can share the same client code (connection, emit, on) between React Native and web. |
| **CORS** | Server must allow your web origin (CORS and Socket.io transport options). |
| **Proxies / corporate networks** | Usually works because it uses HTTP/WebSockets, which most networks allow. |

### Configuration (this POC)

- **Server:** Express + `socket.io` on port 3001 (see `server/index.js`).
- **Client:** `CONFIG.SOCKET_IO_URL` in `src/constants/config.ts` (e.g. `http://localhost:3001`).
- **Transports:** We use `transports: ['websocket']`; you can add `'polling'` for fallback.

### Pros

- Simple mental model: one server, many clients; server controls who gets what.
- Same API on React Native and web; easy to share logic.
- Built-in reconnection and room/namespace support.
- No extra infrastructure (no MQTT broker, no TURN if you don’t need it).
- Easy to add auth, logging, and server-side logic (e.g. rate limiting, validation).

### Cons

- **Latency:** Every message goes server → client, so at least one extra hop (and server CPU) compared to direct P2P.
- **Scalability:** All traffic and connection state go through your server; you need to scale the server and possibly use sticky sessions / Redis for multi-instance.
- **Bandwidth cost:** Server receives and re-sends every message; doubles traffic through the server.
- **Single point of failure:** If the server is down, no real-time communication.

### Best for

- Apps where you want a central authority (auth, rooms, server logic).
- When you don’t need minimal latency or minimal server load.
- When you want one stack (Node + Socket.io) for both signaling and data.

---

## 2. MQTT

### What it is

**MQTT** is a **publish/subscribe** protocol designed for lightweight, low-bandwidth messaging. Clients connect to an **MQTT broker** (not your app server). They **publish** messages to **topics** and **subscribe** to topics; the broker delivers messages from publishers to subscribers. Your app server does **not** have to be in the path of the data.

### Data flow

```
Evaluator  ──publish──►  MQTT Broker  ──deliver──►  Client
  (topic: realtime-sync/clients/{clientId}/image)      (subscribed to same topic)
  ◄──subscribe──  realtime-sync/acks/{evaluatorId}  ◄──publish (sentAt, receivedAt)
```

- Evaluator publishes to e.g. `realtime-sync/clients/client1/image` with payload `{ imageIndex, imageUrl, sentAt }`.
- Client is subscribed to `realtime-sync/clients/client1/image` (and start/end topics).
- **Broker** receives from evaluator and delivers to client. Your Node server is **not** involved in this data path (only for auth/HTTP if you use it).
- **Latency metrics:** After receiving each image, the client publishes to `realtime-sync/acks/{evaluatorId}` with `{ sentAt, receivedAt }` (evaluatorId comes from the session start message). The evaluator subscribes to `realtime-sync/acks/{userId}` and records latency so the performance panel shows real-time metrics.

### What you need to use it

| Requirement | Details |
|------------|--------|
| **MQTT broker** | A running MQTT broker (e.g. **Mosquitto**, **EMQX**, **HiveMQ**), or a **cloud MQTT service** (e.g. EMQX Cloud, AWS IoT, HiveMQ Cloud). |
| **Client library** | In JS/TS: `mqtt` (works in Node and in browser with WebSocket transport). In React Native we use `mqtt` with `ws://` or `wss://` broker URL. |
| **Protocol** | MQTT over TCP, or **MQTT over WebSockets** (e.g. `ws://broker.example.com:8083/mqtt`) for browsers and restricted networks. |
| **Port** | Broker’s port (e.g. 1883 TCP, 8083 WebSocket). |

### Web (browser) feasibility

| Aspect | Support |
|--------|--------|
| **Browser support** | Yes, with **MQTT over WebSockets**. Many brokers expose a WebSocket port (e.g. 8083). The `mqtt` npm package works in the browser when the broker URL is `ws://` or `wss://`. |
| **Same codebase** | Same client code (connect, subscribe, publish) can run in React Native and web. |
| **CORS** | Only relevant if the broker is on another origin; broker must allow WebSocket from your domain. |
| **Public brokers** | For testing, public brokers (e.g. `broker.emqx.io`) work from both mobile and web; for production use your own broker or cloud MQTT. |

### Configuration (this POC)

- **Broker:** We use a **public broker** for POC: `ws://broker.emqx.io:8083/mqtt` (see `CONFIG.MQTT_BROKER_URL`).
- **Topics:**  
  - `realtime-sync/clients/{clientId}/start` — session start (payload includes evaluatorId, evaluatorName).  
  - `realtime-sync/clients/{clientId}/image` — image updates.  
  - `realtime-sync/clients/{clientId}/end` — session end.  
  - `realtime-sync/acks/{evaluatorId}` — client publishes latency acks here; evaluator subscribes to receive them.
- **QoS:** We use QoS 1 (at least once delivery) for reliability; you can tune per topic.
- **No app server in data path:** Auth/HTTP can still be your Node server; MQTT traffic goes only to the broker.

### Pros

- **Decoupled:** Your app server doesn’t handle real-time data; only the broker does. Good for scaling and separation of concerns.
- **Lightweight:** Small headers and binary-friendly; good for constrained devices and networks.
- **Built-in features:** QoS, retained messages, last-will testament; many brokers support clustering and persistence.
- **Works on web:** With WebSocket transport, same client code works in browser and React Native.
- **Many cloud options:** EMQX Cloud, AWS IoT Core, etc., so you don’t have to run your own broker.

### Cons

- **Extra infrastructure:** You must run or use a broker; not “just a Node server.”
- **No built-in “rooms” or “sessions”:** You design topic layout and access control yourself (e.g. who can publish to which topic).
- **Ordering:** Guaranteed only per topic with QoS; if you need strict global order across topics, you need to design for it.
- **Discovery:** Client must know topic names (e.g. which clientId to subscribe to). In this POC we use a convention (evaluator publishes to `clients/{clientId}/...`).

### Best for

- Many clients, many topics; you want the broker to handle fan-out.
- IoT / constrained devices; you want a standard, lightweight protocol.
- When you’re okay adding a broker and defining a topic scheme, and want your app server to stay out of the real-time path.

---

## 3. WebRTC

### What it is

**WebRTC** provides **peer-to-peer** connections between two (or more) peers. In this POC we use the **data channel** (RTCDataChannel) to send JSON (e.g. image index + URL) directly between evaluator and client. **No application data goes through your server**; the server is used only for **signaling** (exchanging SDP and ICE candidates so the peers can establish the P2P connection).

### Data flow

- **Signaling (via your server):**  
  Evaluator and client connect to your **Socket.io server** and exchange:
  - SDP offer (evaluator → server → client)
  - SDP answer (client → server → evaluator) — the evaluator must call `setRemoteDescription(answer)` when it receives the answer so the peer connection can complete.
  - ICE candidates (both ways via server). Candidates that arrive before the remote SDP is set are buffered and applied after `setRemoteDescription` (trickle ICE).
- **Data (direct P2P):**  
  Once the peer connection is established, image updates are sent over the **RTCDataChannel** from evaluator to client with **no server in the path**. The client sends a `ready` message when its data channel opens; the evaluator may send the current image in response. The client replies with an ack `{ type: 'ack', sentAt, receivedAt }` so the evaluator can record latency.

```
Signaling:  Evaluator ◄──► Socket.io Server ◄──► Client
Data:       Evaluator ═══════════════════════════ Client
                         (direct P2P)
```

- **Implementation (react-native-webrtc):** The data channel uses the EventTarget-style API (`addEventListener` / `removeEventListener` for `open`, `message`, `close`) where available, with a fallback to `onopen` / `onmessage` / `onclose` for compatibility.

### What you need to use it

| Requirement | Details |
|------------|--------|
| **Signaling channel** | Any way to exchange SDP and ICE (WebSocket, Socket.io, HTTP, MQTT, etc.). In this POC we use the **same Socket.io server** as the signaling channel. |
| **STUN** | So peers can discover their public IP and port. We use a public STUN server (e.g. `stun.l.google.com:19302`). No account needed. |
| **TURN (optional)** | If direct P2P fails (strict NATs/firewalls), a TURN server relays media/data. Not required for many networks; add TURN if you see connection failures. |
| **Client library** | In browser: **native WebRTC API** (no extra lib). In React Native: **react-native-webrtc** (wraps native WebRTC). |

### Web (browser) feasibility

| Aspect | Support |
|--------|--------|
| **Browser support** | Yes. WebRTC is **native in browsers** (Chrome, Firefox, Safari, Edge). You use `RTCPeerConnection`, `RTCDataChannel`, etc. No extra SDK for data channel. |
| **Same logic, different APIs** | Concept is the same (offer/answer, ICE, data channel). Browser uses global `RTCPeerConnection`; React Native uses `react-native-webrtc`. You can share signaling and message format; the peer connection setup code may differ slightly (browser vs RN). |
| **HTTPS** | Browsers require **secure context** (HTTPS or localhost) for WebRTC. |
| **Permissions** | No special user permission for data channel only; getUserMedia is only for camera/mic. |

### Configuration (this POC)

- **Signaling:** Socket.io server (same as Socket.io transport). Events: `webrtc_signal` with `{ targetUserId, signal }` (signal = SDP offer/answer or ICE candidate). The evaluator handles both `offer` (client only) and `answer` (evaluator only); ICE candidates are buffered until the remote description is set.
- **STUN:** `{ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }` in `WebRtcService.ts`. No TURN in POC.
- **Data channel:** Single channel, label `image-sync`, ordered. Messages: image payload `{ imageIndex, imageUrl, sentAt }`; client acks with `{ type: 'ack', sentAt, receivedAt }` for latency; client may send `{ type: 'ready' }` when channel opens to request the current image.

### Pros

- **Low latency:** Data goes directly between peers; no server hop for image updates.
- **Server load:** Server only does signaling (small, infrequent messages); no relaying of image data.
- **Scalability:** Your server doesn’t scale with the amount of real-time data; only with the number of signaling connections.
- **Privacy:** Application data does not pass through your server.
- **Web-native:** Browsers support WebRTC out of the box; no extra transport library for the data path.

### Cons

- **Complexity:** You must implement (or reuse) signaling, offer/answer, and ICE handling. Connection state is more complex than “connect and send.”
- **NAT/firewall:** Some networks block P2P; then you need TURN (and a TURN server), which adds cost and setup.
- **No built-in “rooms”:** You decide how to map “session” or “room” to peer connections (in POC: one evaluator–one client per session).
- **React Native:** Requires native module (`react-native-webrtc`); slightly more setup than pure JS (Socket.io/MQTT).

### Best for

- When you want minimal latency and minimal server traffic.
- When you’re okay with signaling + STUN (and TURN if needed) and more complex connection logic.
- When the same “direct P2P” behavior is desired on web and mobile (with shared signaling and message format).

---

## 4. Quick comparison table

| Criteria | Socket.io | MQTT | WebRTC |
|----------|-----------|------|--------|
| **Data path** | Client → Server → Client | Client → Broker → Client | Client ↔ Client (P2P) |
| **Server in data path?** | Yes (relays every message) | No (broker is separate) | No (only signaling) |
| **Web feasible?** | Yes (same client lib) | Yes (MQTT over WebSockets) | Yes (native WebRTC) |
| **Extra infrastructure** | Your Node (or other) server | MQTT broker (or cloud) | Signaling server + STUN (TURN optional) |
| **Latency** | Higher (server hop) | Broker hop | Lowest (direct) |
| **Scalability (server)** | Limited by server traffic | Server not in data path | Server only for signaling |
| **Setup complexity** | Low | Medium (broker + topics) | Higher (signaling + ICE) |
| **Evaluator latency metrics** | Yes (client sends `image_ack`, server forwards) | Yes (client publishes to acks topic) | Yes (client acks over data channel) |
| **Best for** | Central control, simple stack | Decoupled, many clients/topics | Low latency, P2P, privacy |

---

## Summary

- **Socket.io:** Easiest to run (one server), data always via server; client sends `image_ack` so evaluator sees real-time latency; works on web and React Native; good when you want one backend to own the real-time flow.
- **MQTT:** Needs a broker; data goes through the broker, not your app server; client publishes to `realtime-sync/acks/{evaluatorId}` so evaluator sees real-time latency; works on web (WebSocket) and RN; good for many clients/topics and decoupled design.
- **WebRTC:** Data is peer-to-peer; server only for signaling; client acks over the data channel so evaluator sees real-time latency; evaluator must handle SDP answer and buffer ICE candidates; works on web (native API) and RN (react-native-webrtc); best for latency and server load, at the cost of signaling and optional TURN setup.

All three are **feasible for web**; the main differences are where the data travels, what infrastructure you run, and how much complexity you accept for lower latency and better scalability.

### POC-specific behaviour

- **Protocol filtering:** The evaluator’s client list (HTTP `GET /api/clients?package=...`) returns only online clients that registered with the same protocol (socketio, webrtc, or mqtt). The UI shows the active protocol (e.g. “Select Client (WebRTC only)”).
- **Performance metrics:** For all three protocols, the evaluator’s performance panel (last/avg/min/max latency, sample count, success/failed) is updated in real time because the client sends acks (Socket.io: `image_ack`; MQTT: acks topic; WebRTC: ack over data channel). The session context polls metrics every second while a session is active.
