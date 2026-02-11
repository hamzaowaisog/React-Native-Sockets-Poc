/**
 * Real-time sync types and RealtimeService interface
 */

export type UserRole = 'evaluator' | 'client';

export type RealtimePackage = 'mqtt' | 'webrtc' | 'socketio';

export interface LatencyMetrics {
  lastLatencyMs: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  sampleCount: number;
  reconnectionAttempts: number;
  failedMessages: number;
  successfulMessages: number;
}

export interface RealtimeService {
  connect(userId: string, role: UserRole): Promise<void>;
  disconnect(): Promise<void>;

  // Evaluator methods
  startSession(clientId: string): Promise<void>;
  sendImageUpdate(imageIndex: number, imageUrl: string): Promise<void>;
  endSession(): Promise<void>;

  // Client methods
  onImageUpdate(callback: (imageIndex: number, imageUrl: string) => void): void;
  onSessionStart(callback: (evaluatorName: string) => void): void;
  onSessionEnd(callback: () => void): void;

  // Performance tracking
  getLatencyMetrics(): LatencyMetrics;
}

export interface SessionInfo {
  sessionId: string;
  evaluatorId: string;
  clientId: string;
  startedAt: number;
}

export interface ImageItem {
  id: number;
  url: string;
}
