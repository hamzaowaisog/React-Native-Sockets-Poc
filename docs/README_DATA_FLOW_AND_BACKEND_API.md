# Data Flow & Backend API Guide

This document explains **how data is sent** in the POC and how **backend developers** can design an API (e.g. with S3) to store segments.

---

## 1. High-level: two data paths

| Path | What is sent | Who → Where | Purpose |
|------|----------------|-------------|---------|
| **WebRTC (P2P)** | Image + signed URL | Evaluator → Client (direct, no server) | Show image on client; client keeps signedUrl for the segment |
| **HTTP** | Segment (signedUrl + audio + metadata) | Client → Your backend | Persist one segment per image (for S3, DB, etc.) |

The server is **not** in the image path. Images and signed URLs go over WebRTC. Only the **segment payload** (with signedUrl and audio) is sent to your backend over HTTP.

---

## 2. How data is sent (step by step)

1. **Evaluator** selects an image and sends over **WebRTC data channel** (P2P):
   - `imageIndex` (number)
   - `imageUrl` (string) – used by the client to **display** the image
   - `signedUrl` (string) – used later to **associate** this image with the recorded audio when the segment is submitted

2. **Client** receives that message and:
   - Shows the image (`imageUrl`)
   - Starts (or continues) **audio recording**
   - Stores `imageIndex` and `signedUrl` for the **current** image

3. When the **evaluator presses “Next”**, the evaluator sends the **next** image (same WebRTC channel). The client then:
   - **Stops** the current recording
   - **POSTs a segment** to your backend with:
     - The **previous** image’s `imageIndex` and `signedUrl`
     - The **recorded audio** (base64)
     - Session/user identifiers
   - **Starts** a new recording for the new image
   - Shows the new image

4. **One segment per image**: The client only sends a segment when the image **changes** (and on session end for the last image if not yet sent). The backend should treat one segment per `(evaluatorId, clientId, imageIndex)` (overwrite or ignore duplicates).

So:

- **Image + signedUrl** → always over **WebRTC** (evaluator → client).
- **Segment (signedUrl + audio + metadata)** → over **HTTP** (client → your backend).

---

## 3. Segment API contract (for backend)

The **client** sends a **POST** with a JSON body. Your backend should accept the same contract so the app keeps working when you replace the POC server.

### Request

**Method:** `POST`  
**URL:** e.g. `POST /api/session/segment` (or your chosen path)  
**Headers:** `Content-Type: application/json`  
**Body size:** Can be large (audio as base64). Allow at least **10MB** (e.g. Express: `express.json({ limit: '10mb' })`).

**Body fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | string \| null | No | Session identifier from your app |
| `evaluatorId` | string \| null | No | Evaluator user id |
| `clientId` | string \| null | No | Client user id |
| `imageIndex` | number | Yes | Index of the image this segment belongs to (0, 1, 2, …) |
| `signedUrl` | string \| null | Yes* | URL to associate with this segment (e.g. S3 presigned URL or image reference). *At least one of `signedUrl` or `audioBase64` must be present. |
| `audioBase64` | string \| null | No | Recorded audio for this image, base64-encoded (e.g. M4A). Can be null if no audio. |

**Example body:**

```json
{
  "sessionId": "sess_evaluator1_client1_1739123456789",
  "evaluatorId": "evaluator1",
  "clientId": "client1",
  "imageIndex": 0,
  "signedUrl": "https://your-bucket.s3.amazonaws.com/path/to/image0?X-Amz-...",
  "audioBase64": "AAAAGGZ0eXBNNEEgAAACAE00QSBpc29t..."
}
```

### Response

**Success (e.g. 200):**

```json
{
  "ok": true,
  "segmentId": "evaluator1_client1_0"
}
```

`segmentId` can be any string your backend uses to identify this segment (e.g. composite key or UUID).

**Error (e.g. 400):**

```json
{
  "error": "signedUrl or audioBase64 required"
}
```

### Deduplication

- The client may send at most **one segment per image per client per session** in normal flow; duplicates can happen due to retries or session end.
- Backend should store **one record per `(evaluatorId, clientId, imageIndex)`** (or per `sessionId` + `imageIndex`). On duplicate, **overwrite** or **ignore** so you don’t store multiple segments for the same image.

---

## 4. Backend design for S3 storage

Below is a **concrete way** to design the API so segments are stored in S3 and metadata in your DB.

### 4.1 Responsibilities

1. **Accept** the segment (same request contract as above).
2. **Upload audio** to S3 (decode base64 → binary → put to S3).
3. **Store metadata** (and optionally link to image) in your DB or via `signedUrl`.

### 4.2 S3 object layout (example)

- **Audio:** one object per segment, e.g.  
  `s3://your-bucket/recordings/{sessionId}/{clientId}_{imageIndex}.m4a`  
  or  
  `s3://your-bucket/recordings/{evaluatorId}/{clientId}/{imageIndex}.m4a`

- **Images:** if you use `signedUrl` as a presigned **PUT** URL, the evaluator (or another service) can upload the image to that URL; the same `signedUrl` is then sent in the segment so you can link audio to that object.  
  If `signedUrl` is only a **reference** (e.g. existing image URL or key), store it in metadata and use it for lookups.

### 4.3 API handler (pseudocode)

```text
POST /api/session/segment
1. Parse body: sessionId, evaluatorId, clientId, imageIndex, signedUrl, audioBase64
2. Validate: at least one of signedUrl or audioBase64 present
3. Dedupe key = (evaluatorId, clientId, imageIndex)   // or (sessionId, imageIndex)
4. If audioBase64:
   a. Decode base64 → buffer
   b. S3 key = e.g. "recordings/{sessionId}/{clientId}_{imageIndex}.m4a"
   c. PutObject to S3 (buffer, Content-Type: audio/mp4 or audio/m4a)
   d. Store final S3 URL or key in metadata
5. Save metadata (and signedUrl) to DB:
   - segmentId / composite key
   - sessionId, evaluatorId, clientId, imageIndex
   - signedUrl (from request)
   - audioS3Key or audioUrl (from step 4)
   - receivedAt
6. Return { ok: true, segmentId: <key or id> }
```

### 4.4 Using `signedUrl` in production

- **Option A – Presigned PUT for image:**  
  Backend (or another service) generates a presigned PUT URL for the image object; that URL is sent to the evaluator as `signedUrl`. Evaluator uploads the image to S3 using it. The **same** `signedUrl` (or the final object key) is sent in the segment so you can link “this audio goes with this image object.”

- **Option B – Reference only:**  
  `signedUrl` is an existing image URL or S3 key. Backend stores it in the segment record so you can later resolve “segment for image X” to “image at signedUrl” and “audio at audioS3Key.”

Either way, the **client only sends the same `signedUrl` it received over WebRTC** in the segment body; the backend decides how to store and use it (S3 key, metadata, etc.).

---

## 5. End-to-end flow (summary)

```text
Evaluator                          Client                           Backend
    |                                  |                                 |
    |  WebRTC: imageIndex, imageUrl,   |                                 |
    |          signedUrl               |                                 |
    |--------------------------------->|  display image, start recording |
    |                                  |                                 |
    |  WebRTC: next image             |                                 |
    |--------------------------------->|  stop recording                 |
    |                                  |  POST /api/session/segment      |
    |                                  |  { imageIndex, signedUrl,        |
    |                                  |    audioBase64, ... }            |
    |                                  |--------------------------------->|  decode audio
    |                                  |                                 |  upload to S3
    |                                  |                                 |  save metadata (+ signedUrl)
    |                                  |<---------------------------------|  200 { ok, segmentId }
    |                                  |  start new recording, show image |
```

- **WebRTC:** image + signedUrl (P2P; no backend in path).
- **HTTP:** one segment per image (signedUrl + audio + ids); backend stores audio in S3 and metadata (and signedUrl) in DB, with one record per image per client.

---

## 6. POC server vs your backend

- The **POC server** (`server/index.js`) implements the same segment contract and saves audio to the local `recordings/` folder for testing.
- **Backend developers** can:
  - Keep the same **request/response contract** as in §3.
  - Replace the in-memory/local file logic with **S3 upload + DB** as in §4.
  - Point the app’s `API_BASE_URL` to the new backend so the client continues to POST segments without app changes.

If you want, the next step is to add a short “Environment / config” section listing the app’s `API_BASE_URL` and any backend base URL so the team knows where to point the client.
