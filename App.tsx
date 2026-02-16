import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, RealtimeProvider, SessionProvider } from './src/context';
import { RootNavigator } from './src/navigation';
import { setRecordingAdapter } from './src/services/audio/RecordingAdapter';
import { getRealRecordingAdapter } from './src/services/audio/RealRecordingAdapter';

export default function App() {
  useEffect(() => {
    const real = getRealRecordingAdapter();
    if (real) setRecordingAdapter(real);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0f0f14" />
      <AuthProvider>
        <RealtimeProvider>
          <SessionProvider>
            <RootNavigator />
          </SessionProvider>
        </RealtimeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
