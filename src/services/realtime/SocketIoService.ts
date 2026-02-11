/**
 * Socket.io implementation of RealtimeService
 */

import { io, Socket } from 'socket.io-client';
import type { IRealtimeService } from './RealtimeService.interface';
import {
  createDefaultLatencyMetrics,
  type LatencyMetrics,
} from './RealtimeService.interface';
import type { UserRole } from '../../types/realtime.types';
import { CONFIG } from '../../constants/config';

type ImageUpdateCallback = (imageIndex: number, imageUrl: string) => void;
type SessionStartCallback = (evaluatorName: string) => void;
type SessionEndCallback = () => void;

export class SocketIoRealtimeService implements IRealtimeService {
  private socket: Socket | null = null;
  private userId: string = '';
  private role: UserRole | null = null;
  private sessionId: string | null = null;
  private clientId: string | null = null;
  private metrics = createDefaultLatencyMetrics();
  private imageUpdateCallbacks: Set<ImageUpdateCallback> = new Set();
  private sessionStartCallbacks: Set<SessionStartCallback> = new Set();
  private sessionEndCallbacks: Set<SessionEndCallback> = new Set();

  async connect(userId: string, role: UserRole): Promise<void> {
    if (this.socket?.connected) await this.disconnect();
    this.userId = userId;
    this.role = role;
    return new Promise((resolve, reject) => {
      this.socket = io(CONFIG.SOCKET_IO_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });
      this.socket.on('connect', () => {
        this.socket?.emit('register', { userId, role });
        resolve();
      });
      this.socket.on('connect_error', (err) => reject(err));
      this.socket.on('image_update', (payload: { imageIndex: number; imageUrl: string; sentAt?: number }) => {
        const receivedAt = Date.now();
        const latency = payload.sentAt ? receivedAt - payload.sentAt : 0;
        this.recordLatency(latency);
        this.metrics.successfulMessages++;
        this.imageUpdateCallbacks.forEach((cb) => cb(payload.imageIndex, payload.imageUrl));
      });
      this.socket.on('session_started', (payload: { evaluatorName?: string; sessionId?: string } = {}) => {
        if (payload.evaluatorName !== undefined) {
          this.sessionStartCallbacks.forEach((cb) => cb(payload.evaluatorName ?? 'Evaluator'));
        }
      });
      this.socket.on('session_ended', () => {
        this.sessionId = null;
        this.clientId = null;
        this.sessionEndCallbacks.forEach((cb) => cb());
      });
      this.socket.on('reconnect', () => {
        this.metrics.reconnectionAttempts++;
        if (this.userId && this.role) this.socket?.emit('register', { userId: this.userId, role: this.role });
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.sessionId = null;
    this.clientId = null;
    this.imageUpdateCallbacks.clear();
    this.sessionStartCallbacks.clear();
    this.sessionEndCallbacks.clear();
  }

  async startSession(clientId: string): Promise<void> {
    if (!this.socket?.connected || this.role !== 'evaluator') return;
    this.clientId = clientId;
    return new Promise((resolve) => {
      const onStarted = (payload: { sessionId?: string }) => {
        this.sessionId = payload?.sessionId || null;
        this.socket?.off('session_started', onStarted);
        resolve();
      };
      this.socket?.on('session_started', onStarted);
      this.socket?.emit('start_session', { clientId });
    });
  }

  async sendImageUpdate(imageIndex: number, imageUrl: string): Promise<void> {
    if (!this.socket?.connected || this.role !== 'evaluator') {
      this.metrics.failedMessages++;
      return;
    }
    const sentAt = Date.now();
    this.socket.emit('image_update', { imageIndex, imageUrl, sentAt });
    this.metrics.successfulMessages++;
  }

  async endSession(): Promise<void> {
    if (this.socket?.connected && this.role === 'evaluator') {
      this.socket.emit('end_session');
    }
    this.sessionId = null;
    this.clientId = null;
  }

  onImageUpdate(callback: ImageUpdateCallback): void {
    this.imageUpdateCallbacks.add(callback);
  }

  onSessionStart(callback: SessionStartCallback): void {
    this.sessionStartCallbacks.add(callback);
  }

  onSessionEnd(callback: SessionEndCallback): void {
    this.sessionEndCallbacks.add(callback);
  }

  getLatencyMetrics(): LatencyMetrics {
    return { ...this.metrics };
  }

  private recordLatency(ms: number): void {
    this.metrics.lastLatencyMs = ms;
    this.metrics.sampleCount++;
    const sum = this.metrics.avgLatencyMs * (this.metrics.sampleCount - 1) + ms;
    this.metrics.avgLatencyMs = sum / this.metrics.sampleCount;
    this.metrics.minLatencyMs = Math.min(this.metrics.minLatencyMs, ms);
    this.metrics.maxLatencyMs = Math.max(this.metrics.maxLatencyMs, ms);
  }
}

export const socketIoRealtimeService = new SocketIoRealtimeService();
