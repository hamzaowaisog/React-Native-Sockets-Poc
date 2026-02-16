# WebRTC + Signed URL + Audio Segment Architecture

## Is it possible?

**Yes.** The flow you described is achievable while keeping WebRTC P2P intact: image and signed URL are delivered over the data channel (evaluator → client); only the segment upload (signed URL + audio) goes client → server. No timeout, no queueing, minimal and scalable.

---

## Requirements (summary)

1. **Image payload** includes both display URL and **signed URL** (for later storage).
2. **First image shown** → client starts audio recording.
3. **Evaluator presses Next** → next image is sent over WebRTC → client: stops current recording, sends **(previous image’s signed URL + recorded audio)** to server for storage, starts new recording, shows new image. Repeat.
4. **WebRTC P2P** stays intact: signaling only over Socket.io; image + signedUrl over RTCDataChannel.
5. **Minimal**: no timeout-based flow, no queueing; one segment at a time.

---

## Architecture

### Data flow

```
Evaluator                          Client                           Server
    |                                  |                                |
    |  WebRTC Data Channel (P2P)       |                                |
    |  { imageIndex, imageUrl,        |                                |
    |    signedUrl, sentAt }           |                                |
    |-------------------------------->|  show image                    |
    |                                  |  start recording (if 1st)      |
    |  (evaluator presses Next)         |                                |
    |  same channel, next image        |                                |
    |-------------------------------->|  stop recording                 |
    |                                  |  POST /api/session/segment     |
    |                                  |  { signedUrl, audioBase64, ... }|
    |                                  |------------------------------->|  store
    |                                  |  start new recording           |
    |                                  |  show next image               |
```

- **Image + signed URL**: Sent only over the WebRTC data channel (evaluator → client). No server in the path; P2P preserved.
- **Segment storage**: When the client receives a *new* image (next index), it finalizes the *previous* segment: stop recording, then POST that segment (previous `signedUrl` + audio) to the server. One segment at a time, no queue.

### Why this is minimal and scalable

- **No timeout**: Progression is event-driven (new image = next segment). No “wait N seconds then send.”
- **No queueing**: Client has at most one “current” recording; when the next image arrives, it flushes that one and starts the next. No backlog of segments.
- **P2P preserved**: Heavy data (image URL, signed URL) stays on the data channel; server only receives small control payloads (signaling) and segment metadata + audio on submit.
- **Stateless server for flow**: Server does not track “current image” or timeouts; it just accepts POSTs and stores segments.

---

## Implementation summary

### 1. Image payload (WebRTC)

- **Evaluator** sends over the data channel:  
  `{ imageIndex, imageUrl, signedUrl, sentAt }`
- **Client** receives and uses:
  - `imageUrl` for display
  - `signedUrl` for the segment submitted when the *next* image arrives (or on session end)

`imageUrl` and `signedUrl` can differ (e.g. display URL vs presigned storage URL).

### 2. Signed URL source

- In the POC, each item in the image dataset has optional `signedUrl` (e.g. same as `url` for demos).
- In production, `signedUrl` would typically be a presigned URL (e.g. S3) for the object that will later hold the image reference or metadata; the client sends this same URL in the segment so the server (or another backend) can associate the stored audio with that resource.

### 3. Client segment flow

- **First image received**  
  - Start recording.  
  - Store `previousRef = { imageIndex, signedUrl }`, show image.
- **Subsequent image received (evaluator pressed Next)**  
  - Stop recording → get audio (e.g. base64).  
  - POST segment: `{ sessionId?, evaluatorId?, clientId?, imageIndex: prev.imageIndex, signedUrl: prev.signedUrl, audioBase64 }`.  
  - Start new recording.  
  - Update `previousRef` to current image, show new image.
- **Session end**  
  - Stop recording, POST final segment (same shape), then run session-end logic.

No timeout, no queue: each “next image” event triggers exactly one flush and one new recording.

### 4. Server

- **POST /api/session/segment**  
  Body: `sessionId?`, `evaluatorId?`, `clientId?`, `imageIndex`, `signedUrl`, `audioBase64`.  
  Stores the segment (e.g. in memory for POC; later DB + blob store).
- **GET /api/session/segments**  
  Optional; for POC/debug to list stored segments.

### 5. Audio recording (client)

- A **recording adapter** is used so the same flow works with or without a real recorder.
- **Stub**: `startRecording` / `stopRecording` no-op; `stopRecording` returns `null`. Segments are still sent with `signedUrl` and `audioBase64: null`.
- **Real recording**: Plug in an implementation that uses e.g. `react-native-audio-recorder-player` or `react-native-nitro-sound`, then read the recorded file (e.g. with `react-native-fs`) as base64 and return that from `stopRecording()`.

---

## Files touched (reference)

- **Types / interface**: `imageUrl` + optional `signedUrl`; `onSessionStart` can pass `evaluatorId` / `sessionId` for segment metadata.
- **WebRTC service**: Data channel payload includes `signedUrl`; evaluator sends it, client receives and passes to UI/segment logic.
- **Evaluator**: Sends `signedUrl` from image dataset (or same as `url`) with `sendImageUpdate(index, url, signedUrl)`.
- **Client ImageViewerScreen**: On image update, flush previous segment (stop record, POST), then start new record; on session end, flush last segment. Uses `RecordingAdapter` and `submitSegment()`.
- **Server**: `POST /api/session/segment` and optional `GET /api/session/segments`; Socket.io `image_update` forwards `signedUrl` when used.

---

## Enabling real audio recording

1. Add a recorder (e.g. `react-native-audio-recorder-player` or `react-native-nitro-sound`) and a file reader (e.g. `react-native-fs`).
2. Implement `RecordingAdapter`:  
   - `startRecording()`: start recorder.  
   - `stopRecording()`: stop recorder, get file URI, read file as base64, return base64 string (or null on error).
3. Call `setRecordingAdapter(yourAdapter)` before the client session starts (e.g. in app init or when entering the client flow).

The existing flow (first image → start record; next image → flush segment → start next record) stays the same; only the adapter implementation changes.
