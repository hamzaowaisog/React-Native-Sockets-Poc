# WebRTC handshake and data flow

This document describes the **full WebRTC setup** in this POC: signaling, offer/answer, ICE, and the data channel. It assumes you know the basics of WebRTC (peer connection, SDP, ICE).

---

## 1. Overview

- **Signaling:** All signaling (who talks to whom, offer, answer, ICE candidates) goes over **Socket.io** through the **server**. The server only forwards messages; it does not modify SDP or ICE.
- **Media / data:** Once the peer connection is established, **image + signedUrl** are sent over a **WebRTC data channel** (P2P). The server is **not** in the path for image data.
- **Roles:**
  - **Evaluator** = offerer (creates the peer connection and the data channel).
  - **Client** = answerer (receives the offer and the data channel).

---

## 2. Signaling channel (Socket.io)

Both evaluator and client connect to the same server and register:

1. **Connect:** `io(SOCKET_IO_URL)`
2. **Register:** `emit('register', { userId, role, package: 'webrtc' })`
3. **Listen for signals:** `on('webrtc_signal', (payload) => ...)` where `payload = { fromUserId, signal }`

When a peer wants to send a WebRTC signal to the other:

- **Emit:** `socket.emit('webrtc_signal', { targetUserId, signal })`
- **Server:** Finds the socket(s) for `targetUserId` and forwards: `emit('webrtc_signal', { fromUserId: sender.userId, signal })`
- **Other peer:** Receives `webrtc_signal` and passes `signal` to its WebRTC stack (e.g. `setRemoteDescription`, `addIceCandidate`).

So the server is a **relay** for signaling only. It does not create or inspect SDP/ICE.

---

## 3. Session start (what kicks off the handshake)

1. **Evaluator** taps “Start session” and picks a **clientId**.
2. **Evaluator** calls `startSession(clientId)`:
   - Emits **Socket.io** `start_session`, `{ clientId }`.
3. **Server** handles `start_session`:
   - Creates a session (evaluatorId, clientId, sessionId).
   - Emits **Socket.io** `session_started` to the **client**: `{ sessionId, evaluatorId, evaluatorName }`.
   - Emits **Socket.io** `session_started` to the **evaluator**: `{ sessionId, clientId }`.
4. **Evaluator** then immediately runs **createOfferAndSend(clientId)** (no wait for client UI).  
5. **Client** receives **Socket.io** `session_started` and runs its **session-start** callback (e.g. navigate to ImageViewer). The client does **not** create a peer connection yet; it waits for the **offer** on `webrtc_signal`.

So the handshake is started by the **evaluator** as soon as the server confirms the session.

---

## 4. WebRTC handshake (step by step)

### 4.1 Evaluator: create peer connection and offer

**Evaluator** (offerer) does:

1. **Create RTCPeerConnection**  
   - Config: `iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]`  
   - No media (no audio/video tracks); we only use a data channel.

2. **Create data channel** (before creating the offer)  
   - `pc.createDataChannel('image-sync', { ordered: true })`  
   - This channel is created by the **offerer**, so the **answerer** will receive it via `ondatachannel`.

3. **Set up data channel as sender**  
   - `onopen`: resolve signaling / send pending image if any.  
   - `onclose`: treat as session end.  
   - `onmessage`: handle client messages (e.g. `ack`, `ready`).

4. **ICE candidate handler**  
   - `pc.onicecandidate = (e) => { if (e.candidate) sendSignal(clientId, e.candidate); }`  
   - Every new ICE candidate is sent to the **client** via Socket.io `webrtc_signal`.

5. **Create offer and send**  
   - `pc.createOffer()`  
   - `pc.setLocalDescription(offer)`  
   - `sendSignal(clientId, pc.localDescription)`  
   - So the **offer** (SDP) is sent to the client over Socket.io.

**Order so far:**  
Evaluator sends: **Offer** (and will send **ICE candidates** as they are gathered).

---

### 4.2 Client: receive offer and create answer

**Client** receives `webrtc_signal` with `signal.type === 'offer'` (and later `signal.candidate` for ICE).

When the **offer** arrives:

1. **Create RTCPeerConnection** (only once, when the first offer is received)  
   - Same ICE config: `stun:stun.l.google.com:19302`.  
   - **ondatachannel:** `e.channel` is the data channel created by the evaluator; save it and call **setupDataChannelAsReceiver()**.  
   - **onicecandidate:** `if (e.candidate) sendSignal(fromUserId, e.candidate)` so ICE candidates go back to the evaluator.

2. **Clear and prepare ICE buffer**  
   - `pendingIceCandidates = []` (we may receive ICE before we have set remote description; we’ll buffer them).

3. **Set remote description (offer)**  
   - `pc.setRemoteDescription(new RTCSessionDescription(signal))`

4. **Create answer**  
   - `pc.createAnswer()`  
   - `pc.setLocalDescription(answer)`  
   - `sendSignal(fromUserId, pc.localDescription)`  
   - So the **answer** (SDP) is sent to the evaluator via Socket.io.

5. **Drain buffered ICE candidates**  
   - If any ICE candidates from the evaluator arrived **before** we called `setRemoteDescription`, they were pushed to `pendingIceCandidates`. Now we apply them: `pc.addIceCandidate(...)` for each.

**Order so far:**  
Client sends: **Answer** (and will send **ICE candidates** as they are gathered).

---

### 4.3 Evaluator: receive answer

**Evaluator** receives `webrtc_signal` with `signal.type === 'answer'`:

1. **Set remote description (answer)**  
   - `pc.setRemoteDescription(new RTCSessionDescription(signal))`

2. **Drain buffered ICE candidates**  
   - Same idea: any ICE candidates from the client that arrived before the answer are buffered; now we add them with `addIceCandidate`.

---

### 4.4 ICE candidate exchange (both sides)

- **Evaluator** and **client** both have `onicecandidate` that sends the candidate to the other via **Socket.io** `webrtc_signal` with `signal = candidate` (the RTCIceCandidate-like object).
- **Receiver** side:
  - If we already have `pc.remoteDescription` (offer or answer set), we can apply immediately: `pc.addIceCandidate(new RTCIceCandidate(signal))`.
  - If not (e.g. answer arrived after some candidates), we **buffer** in `pendingIceCandidates` and drain after `setRemoteDescription`.

So the **handshake** is:

1. Evaluator → Client: **Offer** (SDP)  
2. Client → Evaluator: **Answer** (SDP)  
3. Both sides: **ICE candidates** (trickled as they are gathered; order handled by buffering on the answerer side until remote description is set).

The server only forwards these messages; it does not read or change SDP/ICE.

---

## 5. Data channel lifecycle

- **Evaluator** created the channel with `createDataChannel('image-sync', { ordered: true })`, so:
  - **Evaluator** = “sender” side of the channel (our code calls **setupDataChannelAsSender**).
  - **Client** gets the same channel in **ondatachannel** and calls **setupDataChannelAsReceiver**.

When the peer connection is established and the channel opens:

- **Evaluator (sender):**
  - **onopen:** Resolve any “session ready” promise and, if there is a **pendingImage**, send it once (so the client gets the current image as soon as the channel is ready).
  - **onmessage:** Handle JSON: `ack` (latency) or `ready` (client asking for current image); if `ready` and we have pendingImage, send image payload.
  - **onclose:** Treated as session end (close peer connection, notify UI).

- **Client (receiver):**
  - **onopen:** Send `{ type: 'ready' }` so the evaluator knows the channel is up and can send the current image (or resend pending image).
  - **onmessage:** Parse JSON; if it has `imageIndex` and `imageUrl`, call **imageUpdateCallbacks** (so the UI shows the image and starts recording logic) and send back `{ type: 'ack', sentAt, receivedAt }` for latency.
  - **onclose:** Session end (close peer connection, notify UI).

So the **data channel** is used only for:

- **Evaluator → Client:** image payloads `{ imageIndex, imageUrl, signedUrl, sentAt }` (and resend on `ready`).
- **Client → Evaluator:** `{ type: 'ready' }` and `{ type: 'ack', sentAt, receivedAt }`.

No image data goes through the server; it’s all P2P once the handshake is done.

---

## 6. Timeline diagram (signaling + ICE + data channel)

```
Evaluator                    Server (Socket.io)                 Client
    |                               |                               |
    |  start_session { clientId }   |                               |
    |------------------------------>|                               |
    |                               |  session_started (to client)   |
    |                               |------------------------------->|
    |  session_started (to eval)     |                               |
    |<------------------------------|                               |
    |                               |                               |
    |  createOfferAndSend           |                               |
    |  - create RTCPeerConnection   |                               |
    |  - createDataChannel          |                               |
    |  - onicecandidate             |                               |
    |  - createOffer()              |                               |
    |  - setLocalDescription       |                               |
    |  webrtc_signal { offer }      |                               |
    |------------------------------>|  webrtc_signal { offer }       |
    |                               |------------------------------->|
    |                               |                     setRemoteDescription(offer)
    |                               |                     createAnswer()
    |                               |                     setLocalDescription(answer)
    |                               |  webrtc_signal { answer }      |
    |                               |<-------------------------------|
    |  webrtc_signal { answer }     |                               |
    |<------------------------------|                               |
    |  setRemoteDescription(answer) |                               |
    |  drainPendingIceCandidates    |                               |
    |                               |                               |
    |  (ICE candidates may flow in any order, both sides)            |
    |  webrtc_signal { candidate }  |  webrtc_signal { candidate }  |
    |<----------------------------->|<----------------------------->|
    |  addIceCandidate(...)         |               addIceCandidate(...)
    |                               |                               |
    |  ... ICE/DTLS completes, data channel opens ...                |
    |                               |                               |
    |  data channel 'open'          |               data channel 'open'
    |  (send pending image if any)  |               send { type: 'ready' }
    |  <----------------------------- P2P data channel ------------>|
    |  receive 'ready'              |               receive image payload
    |  send image payload           |               send ack, show image
    |  <----------------------------- P2P -------------------------->|
```

After that, every “Next” image is sent the same way: evaluator sends a new image payload on the **same** data channel; client receives it, updates UI, and may send ack.

---

## 7. Summary table

| Step | Who | Action |
|------|-----|--------|
| 1 | Evaluator | Connect Socket.io, register, then start_session(clientId). |
| 2 | Server | Emit session_started to client and evaluator. |
| 3 | Evaluator | Create RTCPeerConnection, createDataChannel('image-sync'), createOffer, setLocalDescription, send **offer** via webrtc_signal. |
| 4 | Client | On webrtc_signal(offer): create RTCPeerConnection, set ondatachannel/onicecandidate, setRemoteDescription(offer), createAnswer, setLocalDescription, send **answer** via webrtc_signal, drain pending ICE. |
| 5 | Evaluator | On webrtc_signal(answer): setRemoteDescription(answer), drain pending ICE. |
| 6 | Both | Exchange **ICE candidates** via webrtc_signal; addIceCandidate on receipt (or buffer until remote description is set). |
| 7 | Both | Once ICE/DTLS succeeds, **data channel** opens. |
| 8 | Client | On data channel open: send `{ type: 'ready' }`. |
| 9 | Evaluator | On data channel open (and on 'ready'): send current image `{ imageIndex, imageUrl, signedUrl, sentAt }`. |
| 10 | Client | On image message: update UI, start/stop recording as per app logic, send `{ type: 'ack', sentAt, receivedAt }`. |

This is the full WebRTC handshake and data flow used in this POC.
