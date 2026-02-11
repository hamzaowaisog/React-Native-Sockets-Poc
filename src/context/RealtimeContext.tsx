/**
 * Realtime context - active package (MQTT/WebRTC/Socket.io) and service instance
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { RealtimePackage } from '../types/realtime.types';
import type { IRealtimeService } from '../services/realtime/RealtimeService.interface';
import {
  mqttRealtimeService,
  socketIoRealtimeService,
  webRtcRealtimeService,
} from '../services/realtime';

const services: Record<RealtimePackage, IRealtimeService> = {
  mqtt: mqttRealtimeService,
  webrtc: webRtcRealtimeService,
  socketio: socketIoRealtimeService,
};

interface RealtimeContextValue {
  package: RealtimePackage;
  setPackage: (pkg: RealtimePackage) => void;
  service: IRealtimeService;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [pkg, setPkg] = useState<RealtimePackage>('socketio');
  const service = useMemo(() => services[pkg], [pkg]);
  const setPackage = useCallback((next: RealtimePackage) => setPkg(next), []);

  const value: RealtimeContextValue = useMemo(
    () => ({ package: pkg, setPackage, service }),
    [pkg, setPackage]
  );

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used within RealtimeProvider');
  return ctx;
}
