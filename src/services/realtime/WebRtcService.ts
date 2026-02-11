/**
 * WebRTC Data Channel implementation of RealtimeService
 * Uses Socket.io for signaling only; image data over RTCDataChannel
 */

import { io, Socket } from 'socket.io-client';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
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

const DATA_CHANNEL_LABEL = 'image-sync';

export class WebRtcRealtimeService implements IRealtimeService {
  private socket: Socket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private userId: string = '';
  private role: UserRole | null = null;
  private remoteUserId: string | null = null;
  private metrics = createDefaultLatencyMetrics();
  private imageUpdateCallbacks: Set<ImageUpdateCallback> = new Set();
  private sessionStartCallbacks: Set<SessionStartCallback> = new Set();
  private sessionEndCallbacks: Set<SessionEndCallback> = new Set();
  private signalingResolve: (() => void) | null = null;

  async connect(userId: string, role: UserRole): Promise<void> {
    if (this.socket?.connected) await this.disconnect();
    this.userId = userId;
    this.role = role;
    return new Promise((resolve, reject) => {
      this.socket = io(CONFIG.SOCKET_IO_URL, {
        transports: ['websocket'],
        reconnection: true,
      });
      this.socket.on('connect', () => {
        this.socket?.emit('register', { userId, role });
        resolve();
      });
      this.socket.on('connect_error', (err) => reject(err));
      this.socket.on('webrtc_signal', (payload: { fromUserId: string; signal: any }) => {
        this.handleSignal(payload.fromUserId, payload.signal);
      });
      this.socket.on('session_ended', () => this.handleSessionEnd());
      this.socket.on('session_started', (payload: { evaluatorId?: string; evaluatorName?: string }) => {
        this.remoteUserId = payload?.evaluatorId || null;
        this.sessionStartCallbacks.forEach((cb) => cb(payload?.evaluatorName ?? 'Evaluator'));
      });
      this.socket.on('reconnect', () => {
        this.metrics.reconnectionAttempts++;
        if (this.userId && this.role) this.socket?.emit('register', { userId: this.userId, role: this.role });
      });
    });
  }

  async disconnect(): Promise<void> {
    this.closePeerConnection();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.remoteUserId = null;
    this.imageUpdateCallbacks.clear();
    this.sessionStartCallbacks.clear();
    this.sessionEndCallbacks.clear();
  }

  async startSession(clientId: string): Promise<void> {
    if (!this.socket?.connected || this.role !== 'evaluator') return;
    this.remoteUserId = clientId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebRTC session start timeout')), 15000);
      this.signalingResolve = () => {
        clearTimeout(timeout);
        resolve();
      };
      this.socket?.emit('start_session', { clientId });
      this.createOfferAndSend(clientId);
    });
  }

  private createOfferAndSend(clientId: string): void {
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    this.pc = new RTCPeerConnection(config);
    this.dataChannel = this.pc.createDataChannel(DATA_CHANNEL_LABEL, { ordered: true });
    this.setupDataChannelAsSender();
    this.pc.onicecandidate = (e) => {
      if (e.candidate) this.sendSignal(clientId, e.candidate);
    };
    this.pc.createOffer()
      .then((offer) => this.pc!.setLocalDescription(offer))
      .then(() => this.sendSignal(clientId, this.pc!.localDescription))
      .catch((err) => {
        this.metrics.failedMessages++;
        this.signalingResolve?.();
      });
  }

  private setupDataChannelAsSender(): void {
    if (!this.dataChannel) return;
    this.dataChannel.onopen = () => this.signalingResolve?.();
    this.dataChannel.onclose = () => this.handleSessionEnd();
  }

  private setupDataChannelAsReceiver(): void {
    if (!this.dataChannel) return;
    this.dataChannel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.imageIndex !== undefined && msg.imageUrl !== undefined) {
          const receivedAt = Date.now();
          const latency = msg.sentAt ? receivedAt - msg.sentAt : 0;
          this.recordLatency(latency);
          this.metrics.successfulMessages++;
          this.imageUpdateCallbacks.forEach((cb) => cb(msg.imageIndex, msg.imageUrl));
        }
      } catch {
        this.metrics.failedMessages++;
      }
    };
    this.dataChannel.onclose = () => this.handleSessionEnd();
  }

  private handleSignal(fromUserId: string, signal: any): void {
    if (!this.pc || !this.socket) return;
    if (signal?.type === 'offer') {
      this.pc.setRemoteDescription(new RTCSessionDescription(signal))
        .then(() => this.pc!.createAnswer())
        .then((answer) => this.pc!.setLocalDescription(answer))
        .then(() => this.sendSignal(fromUserId, this.pc!.localDescription))
        .catch((e) => {
          this.metrics.failedMessages++;
          console.warn('WebRTC answer error', e);
        });
      return;
    }
    if (signal?.candidate) {
      this.pc.addIceCandidate(new RTCIceCandidate(signal)).catch(() => {});
    }
  }

  private async onSessionStartedAsClient(): Promise<void> {
    if (this.role !== 'client' || !this.remoteUserId) return;
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    this.pc = new RTCPeerConnection(config);
    this.pc.ondatachannel = (e) => {
      this.dataChannel = e.channel;
      this.setupDataChannelAsReceiver();
    };
    this.pc.onicecandidate = (e) => {
      if (e.candidate && this.remoteUserId) this.sendSignal(this.remoteUserId, e.candidate);
    };
  }

  private sendSignal(targetUserId: string, signal: any): void {
    this.socket?.emit('webrtc_signal', { targetUserId, signal });
  }

  async sendImageUpdate(imageIndex: number, imageUrl: string): Promise<void> {
    if (this.role !== 'evaluator' || !this.dataChannel || this.dataChannel.readyState !== 'open') {
      this.metrics.failedMessages++;
      return;
    }
    try {
      this.dataChannel.send(JSON.stringify({ imageIndex, imageUrl, sentAt: Date.now() }));
      this.metrics.successfulMessages++;
    } catch {
      this.metrics.failedMessages++;
    }
  }

  async endSession(): Promise<void> {
    this.closePeerConnection();
    if (this.socket?.connected && this.role === 'evaluator') {
      this.socket.emit('end_session');
    }
    this.remoteUserId = null;
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

  private closePeerConnection(): void {
    this.dataChannel?.close();
    this.dataChannel = null;
    this.pc?.close();
    this.pc = null;
  }

  private handleSessionEnd(): void {
    this.closePeerConnection();
    this.remoteUserId = null;
    this.sessionEndCallbacks.forEach((cb) => cb());
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

export const webRtcRealtimeService = new WebRtcRealtimeService();
</think>
Fixing WebRTC service: create the peer connection when the client receives the offer.
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
StrReplace