/**
 * WebRTC Data Channel implementation of RealtimeService
 * Uses Socket.io for signaling only; image data over RTCDataChannel
 * Compatible with react-native-webrtc EventTarget API for data channels.
 */

import { io, Socket } from 'socket.io-client';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
import type { IRealtimeService } from './RealtimeService.interface';
import { createDefaultLatencyMetrics } from './RealtimeService.interface';
import type { LatencyMetrics, UserRole } from '../../types/realtime.types';
import { CONFIG } from '../../constants/config';

type RTCDataChannelLike = ReturnType<RTCPeerConnection['createDataChannel']>;

type ImageUpdateCallback = (imageIndex: number, imageUrl: string) => void;
type SessionStartCallback = (evaluatorName: string) => void;
type SessionEndCallback = () => void;

const DATA_CHANNEL_LABEL = 'image-sync';

export class WebRtcRealtimeService implements IRealtimeService {
  private socket: Socket | null = null;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannelLike | null = null;
  private userId: string = '';
  private role: UserRole | null = null;
  private remoteUserId: string | null = null;
  private metrics = createDefaultLatencyMetrics();
  private imageUpdateCallbacks: Set<ImageUpdateCallback> = new Set();
  private sessionStartCallbacks: Set<SessionStartCallback> = new Set();
  private sessionEndCallbacks: Set<SessionEndCallback> = new Set();
  private signalingResolve: (() => void) | null = null;
  /** Evaluator: last image to send; sent when data channel opens so client gets current image */
  private pendingImage: { imageIndex: number; imageUrl: string } | null = null;
  /** Client: buffer ICE candidates until setRemoteDescription has completed */
  private pendingIceCandidates: any[] = [];
  private dataChannelListeners: { channel: RTCDataChannelLike; open: () => void; close: () => void; message: (e: { data: string | ArrayBuffer | Blob }) => void } | null = null;

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
        this.socket?.emit('register', { userId, role, package: 'webrtc' });
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
        if (this.userId && this.role) this.socket?.emit('register', { userId: this.userId, role: this.role, package: 'webrtc' });
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
    this.pendingImage = null;
    this.pendingIceCandidates = [];
    return new Promise((resolve, _reject) => {
      const timeout = setTimeout(() => {
        this.signalingResolve = null;
        resolve();
      }, 4000);
      this.signalingResolve = () => {
        clearTimeout(timeout);
        this.signalingResolve = null;
        resolve();
      };
      this.socket?.emit('start_session', { clientId });
      this.createOfferAndSend(clientId);
      // Resolve early so evaluator screen loads; data channel will connect in background
      setTimeout(() => {
        if (this.signalingResolve) {
          this.signalingResolve();
        }
      }, 800);
    });
  }

  private createOfferAndSend(clientId: string): void {
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    this.pc = new RTCPeerConnection(config);
    this.dataChannel = this.pc.createDataChannel(DATA_CHANNEL_LABEL, { ordered: true });
    this.setupDataChannelAsSender();
    (this.pc as RTCPeerConnection & { onicecandidate?: (e: { candidate: unknown }) => void }).onicecandidate = (e: { candidate: unknown }) => {
      if (e.candidate) this.sendSignal(clientId, e.candidate);
    };
    this.pc.createOffer()
      .then((offer) => this.pc!.setLocalDescription(offer))
      .then(() => this.sendSignal(clientId, this.pc!.localDescription))
      .catch((_err) => {
        this.metrics.failedMessages++;
        this.signalingResolve?.();
      });
  }

  private setupDataChannelAsSender(): void {
    if (!this.dataChannel) return;
    const onOpen = () => {
      this.signalingResolve?.();
      this.signalingResolve = null;
      if (this.pendingImage) {
        this.sendImageUpdate(this.pendingImage.imageIndex, this.pendingImage.imageUrl);
      }
    };
    const onClose = () => this.handleSessionEnd();
    const onMessage = (event: { data: string | ArrayBuffer | Blob }) => {
      try {
        const raw = event.data;
        const str = typeof raw === 'string' ? raw : (raw && typeof (raw as ArrayBuffer).byteLength !== 'undefined' ? new TextDecoder().decode(raw as ArrayBuffer) : String(raw));
        const msg = JSON.parse(str);
        if (msg.type === 'ack' && typeof msg.sentAt === 'number' && typeof msg.receivedAt === 'number') {
          const latency = msg.receivedAt - msg.sentAt;
          this.recordLatency(latency);
        } else if (msg.type === 'ready' && this.pendingImage && this.dataChannel?.readyState === 'open') {
          this.dataChannel.send(JSON.stringify({
            imageIndex: this.pendingImage.imageIndex,
            imageUrl: this.pendingImage.imageUrl,
            sentAt: Date.now(),
          }));
          this.metrics.successfulMessages++;
        }
      } catch {
        // ignore parse errors
      }
    };
    const ch = this.dataChannel as unknown as { addEventListener(t: string, l: (...args: any[]) => void): void };
    if (typeof ch.addEventListener === 'function') {
      ch.addEventListener('open', onOpen);
      ch.addEventListener('close', onClose);
      ch.addEventListener('message', onMessage);
      this.dataChannelListeners = { channel: this.dataChannel, open: onOpen, close: onClose, message: onMessage };
    } else {
      (this.dataChannel as RTCDataChannelLike & { onopen?: () => void; onclose?: () => void; onmessage?: (e: { data: string | ArrayBuffer | Blob }) => void }).onopen = onOpen;
      (this.dataChannel as RTCDataChannelLike & { onclose?: () => void }).onclose = onClose;
      (this.dataChannel as RTCDataChannelLike & { onmessage?: (e: { data: string | ArrayBuffer | Blob }) => void }).onmessage = onMessage;
    }
  }

  private setupDataChannelAsReceiver(): void {
    if (!this.dataChannel) return;
    const handlePayload = (str: string): void => {
      try {
        const msg = JSON.parse(str);
        if (msg.imageIndex !== undefined && msg.imageUrl !== undefined) {
          this.metrics.successfulMessages++;
          this.imageUpdateCallbacks.forEach((cb) => cb(msg.imageIndex, msg.imageUrl));
          if (this.dataChannel?.readyState === 'open' && typeof msg.sentAt === 'number') {
            this.dataChannel.send(JSON.stringify({ type: 'ack', sentAt: msg.sentAt, receivedAt: Date.now() }));
          }
        }
      } catch {
        this.metrics.failedMessages++;
      }
    };
    const onMessage = (event: { data: string | ArrayBuffer | Blob }) => {
      const raw = event.data;
      if (typeof raw === 'string') {
        handlePayload(raw);
        return;
      }
      if (raw instanceof ArrayBuffer) {
        handlePayload(new TextDecoder().decode(raw));
        return;
      }
      if (typeof (raw as Blob).text === 'function') {
        (raw as Blob).text().then(handlePayload).catch(() => this.metrics.failedMessages++);
        return;
      }
      handlePayload(String(raw));
    };
    const onClose = () => this.handleSessionEnd();
    const onOpen = () => {
      this.dataChannel?.send(JSON.stringify({ type: 'ready' }));
    };
    const ch = this.dataChannel as unknown as { addEventListener(t: string, l: (...args: any[]) => void): void };
    if (typeof ch.addEventListener === 'function') {
      ch.addEventListener('message', onMessage);
      ch.addEventListener('close', onClose);
      ch.addEventListener('open', onOpen);
      this.dataChannelListeners = { channel: this.dataChannel, open: onOpen, close: onClose, message: onMessage };
    } else {
      (this.dataChannel as RTCDataChannelLike & { onmessage?: (e: { data: string | ArrayBuffer | Blob }) => void }).onmessage = onMessage;
      (this.dataChannel as RTCDataChannelLike & { onclose?: () => void }).onclose = onClose;
      (this.dataChannel as RTCDataChannelLike & { onopen?: () => void }).onopen = () => {
        this.dataChannel?.send(JSON.stringify({ type: 'ready' }));
      };
    }
    if (this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify({ type: 'ready' }));
    }
  }

  private handleSignal(fromUserId: string, signal: any): void {
    if (!this.socket) return;
    if (signal?.type === 'offer') {
      this.pendingIceCandidates = [];
      // Client receives offer: create PC if not exists (we don't have one yet)
      if (!this.pc) {
        const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        this.pc = new RTCPeerConnection(config);
        (this.pc as RTCPeerConnection & { ondatachannel?: (e: { channel: RTCDataChannelLike }) => void }).ondatachannel = (e: { channel: RTCDataChannelLike }) => {
          this.dataChannel = e.channel;
          this.setupDataChannelAsReceiver();
        };
        (this.pc as RTCPeerConnection & { onicecandidate?: (e: { candidate: unknown }) => void }).onicecandidate = (e: { candidate: unknown }) => {
          if (e.candidate) this.sendSignal(fromUserId, e.candidate);
        };
      }
      this.pc.setRemoteDescription(new RTCSessionDescription(signal))
        .then(() => this.pc!.createAnswer())
        .then((answer) => this.pc!.setLocalDescription(answer))
        .then(() => this.sendSignal(fromUserId, this.pc!.localDescription))
        .then(() => this.drainPendingIceCandidates())
        .catch((e) => {
          this.metrics.failedMessages++;
          console.warn('WebRTC answer error', e);
        });
      return;
    }
    if (signal?.type === 'answer') {
      // Evaluator receives answer from client: set as remote description then add any buffered ICE candidates
      if (this.pc) {
        this.pc.setRemoteDescription(new RTCSessionDescription(signal))
          .then(() => this.drainPendingIceCandidates())
          .catch((e) => {
            this.metrics.failedMessages++;
            console.warn('WebRTC setRemoteDescription(answer) error', e);
          });
      }
      return;
    }
    if (signal?.candidate) {
      if (this.pc && this.pc.remoteDescription) {
        this.pc.addIceCandidate(new RTCIceCandidate(signal)).catch(() => {});
      } else {
        this.pendingIceCandidates.push(signal);
      }
    }
  }

  private drainPendingIceCandidates(): void {
    if (!this.pc) return;
    const pending = this.pendingIceCandidates;
    this.pendingIceCandidates = [];
    pending.forEach((c) => {
      this.pc!.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    });
  }

  private async onSessionStartedAsClient(): Promise<void> {
    if (this.role !== 'client' || !this.remoteUserId) return;
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    this.pc = new RTCPeerConnection(config);
    (this.pc as RTCPeerConnection & { ondatachannel?: (e: { channel: RTCDataChannelLike }) => void }).ondatachannel = (e: { channel: RTCDataChannelLike }) => {
      this.dataChannel = e.channel;
      this.setupDataChannelAsReceiver();
    };
    (this.pc as RTCPeerConnection & { onicecandidate?: (e: { candidate: unknown }) => void }).onicecandidate = (e: { candidate: unknown }) => {
      if (e.candidate && this.remoteUserId) this.sendSignal(this.remoteUserId, e.candidate);
    };
  }

  private sendSignal(targetUserId: string, signal: any): void {
    this.socket?.emit('webrtc_signal', { targetUserId, signal });
  }

  async sendImageUpdate(imageIndex: number, imageUrl: string): Promise<void> {
    this.pendingImage = { imageIndex, imageUrl };
    if (this.role !== 'evaluator' || !this.dataChannel) {
      this.metrics.failedMessages++;
      return;
    }
    if (this.dataChannel.readyState !== 'open') {
      return;
    }
    try {
      const sentAt = Date.now();
      this.dataChannel.send(JSON.stringify({ imageIndex, imageUrl, sentAt }));
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
    if (this.dataChannelListeners) {
      const { channel, open, close, message } = this.dataChannelListeners;
      const ch = channel as unknown as { removeEventListener(t: string, l: (...args: any[]) => void): void };
      if (typeof ch.removeEventListener === 'function') {
        ch.removeEventListener('open', open);
        ch.removeEventListener('close', close);
        ch.removeEventListener('message', message);
      }
      this.dataChannelListeners = null;
    }
    this.dataChannel?.close();
    this.dataChannel = null;
    this.pc?.close();
    this.pc = null;
    this.pendingImage = null;
    this.pendingIceCandidates = [];
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