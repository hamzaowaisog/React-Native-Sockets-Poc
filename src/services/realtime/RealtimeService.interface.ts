/**
 * RealtimeService interface - shared contract for MQTT, WebRTC, Socket.io
 */

import type { UserRole } from '../../types/realtime.types';
import type { LatencyMetrics } from '../../types/realtime.types';

export type { LatencyMetrics };
export interface IRealtimeService {
  connect(userId: string, role: UserRole): Promise<void>;
  disconnect(): Promise<void>;

  startSession(clientId: string): Promise<void>;
  sendImageUpdate(imageIndex: number, imageUrl: string, signedUrl?: string): Promise<void>;
  endSession(): Promise<void>;

  onImageUpdate(callback: (imageIndex: number, imageUrl: string, signedUrl?: string) => void): void;
  onSessionStart(callback: (evaluatorName: string, evaluatorId?: string, sessionId?: string) => void): void;
  onSessionEnd(callback: () => void): void;

  getLatencyMetrics(): LatencyMetrics;
}

export const createDefaultLatencyMetrics = (): LatencyMetrics => ({
  lastLatencyMs: 0,
  avgLatencyMs: 0,
  minLatencyMs: Infinity,
  maxLatencyMs: 0,
  sampleCount: 0,
  reconnectionAttempts: 0,
  failedMessages: 0,
  successfulMessages: 0,
});
