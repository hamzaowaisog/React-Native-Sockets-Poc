/**
 * Root navigator: Auth stack vs Main (Evaluator/Client) stacks
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context';
import { useRealtime } from '../context';
import { AuthStack } from './AuthStack';
import { EvaluatorStack } from './EvaluatorStack';
import { ClientStack } from './ClientStack';

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { user } = useAuth();
  const { service } = useRealtime();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      setConnected(false);
      service.disconnect();
      return;
    }
    let mounted = true;
    service.connect(user.id, user.role).then(() => {
      if (mounted) setConnected(true);
    }).catch(() => {
      if (mounted) setConnected(false);
    });
    return () => {
      mounted = false;
      service.disconnect();
    };
  }, [user?.id, user?.role, service]);

  if (!user) {
    return (
      <NavigationContainer>
        <AuthStack />
      </NavigationContainer>
    );
  }

  if (user.role === 'evaluator') {
    return (
      <NavigationContainer>
        <EvaluatorStack />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <ClientStack connected={connected} />
    </NavigationContainer>
  );
}
