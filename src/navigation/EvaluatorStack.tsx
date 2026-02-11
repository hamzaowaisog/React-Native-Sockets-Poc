/**
 * Evaluator flow: package selector -> client list -> image control -> metrics
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PackageSelectorScreen } from '../screens/evaluator/PackageSelectorScreen';
import { ClientSelectionScreen } from '../screens/evaluator/ClientSelectionScreen';
import { ImageControlScreen } from '../screens/evaluator/ImageControlScreen';
import { PerformanceMetricsScreen } from '../screens/evaluator/PerformanceMetricsScreen';
import { useAuth, useSession } from '../context';

export type EvaluatorStackParamList = {
  PackageSelector: undefined;
  ClientSelection: undefined;
  ImageControl: undefined;
  PerformanceMetrics: undefined;
};

const Stack = createNativeStackNavigator<EvaluatorStackParamList>();

export function EvaluatorStack() {
  const { logout } = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f0f14' } }}
    >
      <Stack.Screen name="PackageSelector">
        {({ navigation }) => (
          <PackageSelectorScreen
            onBack={logout}
            onContinue={() => navigation.navigate('ClientSelection')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ClientSelection">
        {({ navigation }) => (
          <ClientSelectionScreen
            onBack={logout}
            onSelectClient={(clientId: string) => navigation.navigate('ImageControl', { clientId })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ImageControl" component={ImageControlWrapper} />
      <Stack.Screen name="PerformanceMetrics" component={PerformanceMetricsWrapper} />
    </Stack.Navigator>
  );
}

function ImageControlWrapper({ navigation, route }: any) {
  const clientId = route.params?.clientId;
  const { startSession } = useSession();

  React.useEffect(() => {
    if (clientId) startSession(clientId);
  }, [clientId]);

  return (
    <ImageControlScreen
      onEndSession={() => navigation.navigate('PerformanceMetrics')}
    />
  );
}

function PerformanceMetricsWrapper({ navigation }: any) {
  return (
    <PerformanceMetricsScreen
      onDone={() => navigation.navigate('ClientSelection')}
    />
  );
}
