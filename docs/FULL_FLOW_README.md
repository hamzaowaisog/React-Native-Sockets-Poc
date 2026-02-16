# Full flow: beginning to end

This document explains the **entire flow** from app start to session end, and **how the client decides when to start recording and when to send the recording to the server**.

---

## 1. Before the session (setup)

1. **Evaluator** and **Client** each open the app and log in.
2. Both select the same **package** (e.g. WebRTC).
3. **Evaluator** sees a list of online clients and picks one, then taps **Start session**.
4. **Server** (Socket.io) sends `session_started` to the client with `evaluatorId`, `evaluatorName`, `sessionId`.
5. **Client** navigates to the **ImageViewer** screen and registers two listeners:
   - `onImageUpdate(index, url, signedUrl)` – called whenever the client receives an image over WebRTC.
   - `onSessionEnd()` – called when the evaluator ends the session or the connection drops.
6. **Evaluator** screen loads; WebRTC offer/answer and ICE happen; the **data channel** opens.
7. **Evaluator** sends the **current image** (index 0) over the data channel: `{ imageIndex: 0, imageUrl, signedUrl, sentAt }`.

---

## 2. The only trigger: “image update”

The client does **not** use timers or buttons to decide when to record or send. The **only trigger** is:

- **Receiving an image update** from the evaluator over WebRTC (data channel), or  
- **Session end** (evaluator ended or connection lost).

So:

- **When to start recording** and **when to send to server** are both derived from **“we got an image update”** (or session end).

The client keeps in memory:

- **Previous image:** `previousRef` = last `(imageIndex, signedUrl)` we showed.
- **Recording state:** whether we have already started the recorder for this session.
- **Already sent:** which image indices we have already sent in a segment (so we don’t send twice).

---

## 3. Client logic: when to start recording vs when to send

Every time the client receives an **image update** `(index, url, signedUrl)` it runs this logic.

### 3.1 Definitions

- **prev** = what we had *before* this update (the “previous” image): `previousRef.current` → `{ imageIndex, signedUrl }` or `null` if this is the very first image.
- **index** = the image index we *just* received.

### 3.2 When does the client SEND a recording to the server?

The client sends a segment (previous image’s signedUrl + audio) to the server **only when all of these are true**:

1. There **was** a previous image: `prev !== null`.
2. Recording **has** been started: `recordingStartedRef.current === true`.
3. The update is for a **different** image: `prev.imageIndex !== index`.

So:

- **First image (prev === null):** we do **not** send. We have no “previous” segment to finalize.
- **Same image again (prev.imageIndex === index):** we do **not** send. We only send when we *leave* an image (evaluator pressed Next).
- **New image (prev.imageIndex !== index):** we **do** send. We stop the current recording, send a segment for **prev** (the image we were just showing), then start recording for the **new** image.

In code this is:

```ts
if (prev !== null && recordingStartedRef.current && prev.imageIndex !== index) {
  // 1. Stop recording → get audio (base64)
  // 2. POST segment: prev.imageIndex, prev.signedUrl, audioBase64, ...
  // 3. (Then below we start recording for the new image)
}
```

So: **“When to send” = when we receive an image update for a *different* image than the one we had before** (or on session end for the last image – see below).

### 3.3 When does the client START recording?

The client starts (or restarts) recording when the update is for a **new** image:

- **prev === null** → first image: start recording.
- **prev.imageIndex !== index** → we just got a new image (and we already sent the previous segment above): start recording for this new image.

So:

- **First image:** start recording once we receive it.
- **Every “next” image:** after sending the segment for the *previous* image, we start recording for the *current* (new) image.

In code:

```ts
const isNewImage = prev === null || prev.imageIndex !== index;
if (isNewImage) {
  recordingStartedRef.current = true;
  await recorder.startRecording();
}
previousRef.current = { imageIndex: index, signedUrl: signedUrlForImage };
// ... update UI (setImageIndex, setImageUrl, ...)
```

So: **“When to start” = when we receive the first image, or when we receive a new image (after having just sent the previous segment).**

---

## 4. Flow in time (example)

Assume evaluator has 3 images (index 0, 1, 2).

| Step | Event | Client state before | Client action |
|------|--------|----------------------|----------------|
| 1 | Data channel opens, evaluator sends image **0** | prev = null, no recording | **Start** recording. Set prev = (0, signedUrl0). Show image 0. |
| 2 | Evaluator presses Next, client receives image **1** | prev = (0, …), recording on | **Send** segment (image 0 + signedUrl0 + audio). **Start** recording again. Set prev = (1, …). Show image 1. |
| 3 | Evaluator presses Next, client receives image **2** | prev = (1, …), recording on | **Send** segment (image 1 + signedUrl1 + audio). **Start** recording again. Set prev = (2, …). Show image 2. |
| 4 | Evaluator ends session | prev = (2, …), recording on | **Send** segment (image 2 + signedUrl2 + audio) if not already sent. Stop. Clear refs. Navigate away. |

So:

- **Start recording:** on first image, and again after each “next” image (right after sending the previous segment).
- **Send to server:** when we receive a *different* image (so we send the *previous* image’s segment), and on session end for the *current* image if we haven’t sent it yet.

---

## 5. Session end

When the evaluator ends the session (or the connection drops), the client gets **onSessionEnd()**:

1. **prev** = current image we were showing.
2. If we have a prev and we **haven’t** already sent a segment for that image (`!sentImageIndicesRef.current.has(prev.imageIndex)`), we:
   - Stop recording.
   - POST one last segment for that image (signedUrl + audio).
3. Clear refs and navigate back (e.g. to waiting screen).

So the client sends the **last** image’s recording on session end only if it wasn’t already sent (e.g. evaluator ended before pressing Next again).

---

## 6. Duplicate image updates (same index again)

Sometimes the client can receive the **same** image index again (e.g. WebRTC retries, or evaluator going back). The client avoids duplicate segments:

- **Send:** only when `prev.imageIndex !== index`. So if we receive index 1 again while prev is (1, …), we do **not** send.
- **Start recording:** only when `isNewImage` (prev === null or prev.imageIndex !== index). So we don’t restart recording for the same image.

Result: **one segment per image** in normal use; no duplicate sends for the same index.

---

## 7. End-to-end diagram (full flow)

```
1. Session start
   Evaluator starts session → Server notifies client → Client opens ImageViewer
   → Client subscribes to onImageUpdate + onSessionEnd

2. First image (index 0)
   Evaluator sends { imageIndex: 0, imageUrl, signedUrl } over WebRTC
   → Client receives onImageUpdate(0, url, signedUrl)
   → prev === null → do NOT send
   → isNewImage → START recording
   → previousRef = (0, signedUrl), show image 0

3. Next image (index 1)
   Evaluator presses Next → sends { imageIndex: 1, imageUrl, signedUrl }
   → Client receives onImageUpdate(1, url, signedUrl)
   → prev = (0,…), index 1 !== 0 → SEND segment (image 0 + signedUrl0 + audio)
   → isNewImage → START recording (for image 1)
   → previousRef = (1, signedUrl), show image 1

4. Next image (index 2), same idea
   → SEND segment (image 1 + …), START recording (for 2), show image 2

5. Session end
   → onSessionEnd()
   → If current image (2) not yet sent → SEND segment (image 2 + …)
   → Clear refs, navigate away
```

---

## 8. Summary table

| Question | Answer |
|----------|--------|
| **When does the client start recording?** | When it receives the **first** image, and again each time it receives a **new** image (right after sending the previous segment). |
| **When does the client send to the server?** | When it receives an image update for a **different** image (then it sends the **previous** image’s segment), and on **session end** for the current image if not already sent. |
| **What triggers everything?** | Only **image update** (WebRTC) and **session end**. No timers. |
| **How does it avoid duplicate segments?** | Sends only when `prev.imageIndex !== index`; on session end sends only if that image index wasn’t already sent. Server can also dedupe by (evaluatorId, clientId, imageIndex). |

This is the full flow from beginning to end and how the client knows when to start recording and when to send the recording to the server.
