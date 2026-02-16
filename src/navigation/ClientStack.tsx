/**
 * Client flow: package selector -> waiting for session -> image viewer
 */

import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PackageSelectorScreen } from '../screens/evaluator/PackageSelectorScreen';
import { WaitingScreen } from '../screens/client/WaitingScreen';
import { ImageViewerScreen } from '../screens/client/ImageViewerScreen';
import { useRealtime, useAuth } from '../context';
import * as AuthService from '../services/auth/AuthService';

export type ClientStackParamList = {
  PackageSelector: undefined;
  Waiting: undefined;
  ImageViewer: { evaluatorName: string; evaluatorId?: string; sessionId?: string };
};

const Stack = createNativeStackNavigator<ClientStackParamList>();

export function ClientStack({ connected }: { connected: boolean }) {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f0f14' } }}
    >
      <Stack.Screen name="PackageSelector" component={ClientPackageSelectorWrapper} />
      <Stack.Screen name="Waiting" component={WaitingWrapper} />
      <Stack.Screen name="ImageViewer" component={ImageViewerWrapper} />
    </Stack.Navigator>
  );
}

function ClientPackageSelectorWrapper({ navigation }: any) {
  const { logout } = useAuth();
  return (
    <PackageSelectorScreen
      onBack={logout}
      onContinue={() => navigation.navigate('Waiting')}
    />
  );
}

function WaitingWrapper({ navigation }: any) {
  const { service, package: pkg } = useRealtime();
  const { user, logout } = useAuth();

  useEffect(() => {
    const onStart = (evaluatorName: string, evaluatorId?: string, sessionId?: string) => {
      navigation.navigate('ImageViewer', { evaluatorName, evaluatorId, sessionId });
    };
    service.onSessionStart(onStart);
    return () => {
      service.onSessionStart(() => {});
    };
  }, [service, navigation]);

  // MQTT clients don't use Socket.io; report presence via HTTP so evaluator sees them
  useEffect(() => {
    if (user?.role !== 'client' || pkg !== 'mqtt') return;
    const send = () => AuthService.reportPresence(user!.id, 'mqtt').catch(() => {});
    send();
    const interval = setInterval(send, 10000);
    return () => clearInterval(interval);
  }, [user?.id, user?.role, pkg]);

  return <WaitingScreen onLogout={logout} />;
}

function ImageViewerWrapper({ navigation, route }: any) {
  const evaluatorName = route.params?.evaluatorName ?? null;
  const evaluatorId = route.params?.evaluatorId ?? null;
  const sessionId = route.params?.sessionId ?? null;
  const { service } = useRealtime();
  const { logout } = useAuth();
  useEffect(() => {
    const onEnd = () => navigation.navigate('Waiting');
    service.onSessionEnd(onEnd);
    return () => service.onSessionEnd(() => {});
  }, [service, navigation]);
  return (
    <ImageViewerScreen
      evaluatorName={evaluatorName}
      evaluatorId={evaluatorId}
      sessionId={sessionId}
      onSessionEnd={() => navigation.navigate('Waiting')}
      onLogout={logout}
    />
  );
}
