/**
 * Session context - current image index, client list, session state, metrics
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { LatencyMetrics } from '../types/realtime.types';
import { useAuth } from './AuthContext';
import { useRealtime } from './RealtimeContext';
import * as AuthService from '../services/auth/AuthService';

export interface ClientItem {
  id: string;
  name: string;
  online: boolean;
}

interface SessionState {
  currentImageIndex: number;
  currentImageUrl: string | null;
  connectedClientId: string | null;
  connectedClientName: string | null;
  clients: ClientItem[];
  metrics: LatencyMetrics | null;
  isSessionActive: boolean;
}

interface SessionContextValue extends SessionState {
  setCurrentImageIndex: (index: number) => void;
  setCurrentImageUrl: (url: string | null) => void;
  refreshClients: () => Promise<void>;
  startSession: (clientId: string) => Promise<void>;
  endSession: () => Promise<void>;
  sendImageUpdate: (imageIndex: number, imageUrl: string) => Promise<void>;
  getMetrics: () => LatencyMetrics;
}

const defaultMetrics: LatencyMetrics = {
  lastLatencyMs: 0,
  avgLatencyMs: 0,
  minLatencyMs: Infinity,
  maxLatencyMs: 0,
  sampleCount: 0,
  reconnectionAttempts: 0,
  failedMessages: 0,
  successfulMessages: 0,
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { service } = useRealtime();
  const [currentImageIndex, setCurrentImageIndexState] = useState(0);
  const [currentImageUrl, setCurrentImageUrlState] = useState<string | null>(null);
  const [connectedClientId, setConnectedClientId] = useState<string | null>(null);
  const [connectedClientName, setConnectedClientName] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [metrics, setMetrics] = useState<LatencyMetrics | null>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);

  const setCurrentImageIndex = useCallback((index: number) => {
    setCurrentImageIndexState(index);
  }, []);

  const setCurrentImageUrl = useCallback((url: string | null) => {
    setCurrentImageUrlState(url);
  }, []);

  const refreshClients = useCallback(async () => {
    if (user?.role !== 'evaluator') return;
    try {
      const list = await AuthService.fetchClients();
      setClients(list);
    } catch {
      setClients([]);
    }
  }, [user?.role]);

  const startSession = useCallback(
    async (clientId: string) => {
      if (user?.role !== 'evaluator') return;
      await service.startSession(clientId);
      const client = clients.find((c) => c.id === clientId);
      setConnectedClientId(clientId);
      setConnectedClientName(client?.name ?? clientId);
      setIsSessionActive(true);
      setMetrics(service.getLatencyMetrics());
    },
    [user?.role, service, clients]
  );

  const endSession = useCallback(async () => {
    await service.endSession();
    setConnectedClientId(null);
    setConnectedClientName(null);
    setIsSessionActive(false);
    setMetrics(service.getLatencyMetrics());
  }, [service]);

  const sendImageUpdate = useCallback(
    async (imageIndex: number, imageUrl: string) => {
      await service.sendImageUpdate(imageIndex, imageUrl);
      setMetrics(service.getLatencyMetrics());
    },
    [service]
  );

  const getMetrics = useCallback(() => service.getLatencyMetrics(), [service]);

  useEffect(() => {
    if (user?.role !== 'evaluator') return;
    refreshClients();
    const interval = setInterval(refreshClients, 5000);
    return () => clearInterval(interval);
  }, [user?.role, refreshClients]);

  useEffect(() => {
    const onEnd = () => {
      setIsSessionActive(false);
      setConnectedClientId(null);
      setConnectedClientName(null);
      setMetrics(service.getLatencyMetrics());
    };
    service.onSessionEnd(onEnd);
    return () => {
      service.onSessionEnd(() => {});
    };
  }, [service]);

  const value: SessionContextValue = {
    currentImageIndex,
    currentImageUrl,
    connectedClientId,
    connectedClientName,
    clients,
    metrics,
    isSessionActive,
    setCurrentImageIndex,
    setCurrentImageUrl,
    refreshClients,
    startSession,
    endSession,
    sendImageUpdate,
    getMetrics,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
