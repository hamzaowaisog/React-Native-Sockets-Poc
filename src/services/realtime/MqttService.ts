/**
 * MQTT implementation of RealtimeService
 * Uses topic structure: realtime-sync/clients/{clientId}/start | image | end
 */

import mqtt, { MqttClient } from 'mqtt';
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

const TOPIC_PREFIX = CONFIG.MQTT_TOPIC_PREFIX;

function clientTopic(clientId: string, suffix: string): string {
  return `${TOPIC_PREFIX}/clients/${clientId}/${suffix}`;
}

function evaluatorAckTopic(evaluatorId: string): string {
  return `${TOPIC_PREFIX}/acks/${evaluatorId}`;
}

export class MqttRealtimeService implements IRealtimeService {
  private client: MqttClient | null = null;
  private userId: string = '';
  private role: UserRole | null = null;
  private currentClientId: string | null = null;
  /** Client: evaluator we're in session with (for sending latency acks) */
  private currentEvaluatorId: string | null = null;
  private metrics = createDefaultLatencyMetrics();
  private imageUpdateCallbacks: Set<ImageUpdateCallback> = new Set();
  private sessionStartCallbacks: Set<SessionStartCallback> = new Set();
  private sessionEndCallbacks: Set<SessionEndCallback> = new Set();

  async connect(userId: string, role: UserRole): Promise<void> {
    if (this.client?.connected) await this.disconnect();
    this.userId = userId;
    this.role = role;
    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(CONFIG.MQTT_BROKER_URL, {
        reconnectPeriod: 3000,
        connectTimeout: 10000,
      });
      this.client.on('connect', () => resolve());
      this.client.on('error', (err) => reject(err));
      this.client.on('reconnect', () => {
        this.metrics.reconnectionAttempts++;
      });
      if (role === 'client') {
        const startTopic = clientTopic(userId, 'start');
        const imageTopic = clientTopic(userId, 'image');
        const endTopic = clientTopic(userId, 'end');
        this.client.subscribe([startTopic, imageTopic, endTopic], () => {});
        this.client.on('message', (topic, payload) => {
          try {
            const msg = JSON.parse(payload.toString());
            if (topic.endsWith('/start')) {
              this.currentEvaluatorId = msg.evaluatorId ?? null;
              this.sessionStartCallbacks.forEach((cb) => cb(msg.evaluatorName ?? 'Evaluator'));
            } else if (topic.endsWith('/image')) {
              const receivedAt = Date.now();
              const latency = msg.sentAt ? receivedAt - msg.sentAt : 0;
              this.recordLatency(latency);
              this.metrics.successfulMessages++;
              this.imageUpdateCallbacks.forEach((cb) => cb(msg.imageIndex, msg.imageUrl));
              if (this.currentEvaluatorId != null && msg.sentAt != null) {
                this.client?.publish(
                  evaluatorAckTopic(this.currentEvaluatorId),
                  JSON.stringify({ sentAt: msg.sentAt, receivedAt }),
                  { qos: 0 }
                );
              }
            } else if (topic.endsWith('/end')) {
              this.currentEvaluatorId = null;
              this.sessionEndCallbacks.forEach((cb) => cb());
            }
          } catch {
            this.metrics.failedMessages++;
          }
        });
      } else if (role === 'evaluator') {
        const ackTopic = evaluatorAckTopic(userId);
        this.client.subscribe(ackTopic, () => {});
        this.client.on('message', (topic, payload) => {
          if (topic !== ackTopic) return;
          try {
            const msg = JSON.parse(payload.toString());
            if (typeof msg.sentAt === 'number' && typeof msg.receivedAt === 'number') {
              this.recordLatency(msg.receivedAt - msg.sentAt);
            }
          } catch {
            // ignore
          }
        });
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
    this.currentClientId = null;
    this.currentEvaluatorId = null;
    this.imageUpdateCallbacks.clear();
    this.sessionStartCallbacks.clear();
    this.sessionEndCallbacks.clear();
  }

  async startSession(clientId: string): Promise<void> {
    if (!this.client?.connected || this.role !== 'evaluator') return;
    this.currentClientId = clientId;
    const topic = clientTopic(clientId, 'start');
    this.client.publish(
      topic,
      JSON.stringify({ evaluatorId: this.userId, sessionId: `mqtt_${this.userId}_${clientId}_${Date.now()}` }),
      { qos: 1 }
    );
  }

  async sendImageUpdate(imageIndex: number, imageUrl: string): Promise<void> {
    if (!this.client?.connected || this.role !== 'evaluator' || !this.currentClientId) {
      this.metrics.failedMessages++;
      return;
    }
    const sentAt = Date.now();
    const topic = clientTopic(this.currentClientId, 'image');
    this.client.publish(
      topic,
      JSON.stringify({ imageIndex, imageUrl, sentAt }),
      { qos: 1 }
    );
    this.metrics.successfulMessages++;
  }

  async endSession(): Promise<void> {
    if (this.client?.connected && this.role === 'evaluator' && this.currentClientId) {
      this.client.publish(clientTopic(this.currentClientId, 'end'), JSON.stringify({}), { qos: 1 });
    }
    this.currentClientId = null;
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

export const mqttRealtimeService = new MqttRealtimeService();
