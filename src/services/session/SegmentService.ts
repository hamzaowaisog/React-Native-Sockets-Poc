/**
 * Submit segment (signedUrl + audio) to server when client advances to next image.
 * No queueing: one segment at a time, fire-and-forget or await.
 */

import { CONFIG } from '../../constants/config';

export interface SubmitSegmentPayload {
  sessionId?: string | null;
  evaluatorId?: string | null;
  clientId?: string | null;
  imageIndex: number;
  signedUrl: string | null;
  audioBase64: string | null;
}

export async function submitSegment(payload: SubmitSegmentPayload): Promise<{ ok: boolean; segmentId?: number }> {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/session/segment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: payload.sessionId ?? undefined,
      evaluatorId: payload.evaluatorId ?? undefined,
      clientId: payload.clientId ?? undefined,
      imageIndex: payload.imageIndex,
      signedUrl: payload.signedUrl ?? undefined,
      audioBase64: payload.audioBase64 ?? undefined,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || 'Failed to submit segment');
  }
  return res.json();
}
