/**
 * Auth flow: role selection -> evaluator or client login
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  LoginScreen,
  EvaluatorLoginScreen,
  ClientLoginScreen,
} from '../screens/auth/LoginScreen';
import type { UserRole } from '../types/realtime.types';

export type AuthStackParamList = {
  Login: undefined;
  EvaluatorLogin: undefined;
  ClientLogin: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f0f14' } }}
    >
      <Stack.Screen name="Login" component={LoginScreenWrapper} />
      <Stack.Screen name="EvaluatorLogin" component={EvaluatorLoginWrapper} />
      <Stack.Screen name="ClientLogin" component={ClientLoginWrapper} />
    </Stack.Navigator>
  );
}

function LoginScreenWrapper({ navigation }: any) {
  return (
    <LoginScreen
      onSelectRole={(role: UserRole) => {
        if (role === 'evaluator') navigation.navigate('EvaluatorLogin');
        else navigation.navigate('ClientLogin');
      }}
    />
  );
}

function EvaluatorLoginWrapper({ navigation }: any) {
  return (
    <EvaluatorLoginScreen
      onBack={() => navigation.goBack()}
      onSuccess={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
    />
  );
}

function ClientLoginWrapper({ navigation }: any) {
  return (
    <ClientLoginScreen
      onBack={() => navigation.goBack()}
      onSuccess={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
    />
  );
}
