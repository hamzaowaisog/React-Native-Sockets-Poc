/**
 * Role selector and entry to Evaluator/Client login
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useAuth } from '../../context';
import type { UserRole } from '../../types/realtime.types';

export function LoginScreen({
  onSelectRole,
}: {
  onSelectRole: (role: UserRole) => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Real-Time Image Sync POC</Text>
      <Text style={styles.subtitle}>Select your role to continue</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => onSelectRole('evaluator')}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Evaluator</Text>
        <Text style={styles.hint}>Control images, start sessions</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.buttonClient]}
        onPress={() => onSelectRole('client')}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Client</Text>
        <Text style={styles.hint}>View images in real time</Text>
      </TouchableOpacity>
    </View>
  );
}

export function EvaluatorLoginScreen({
  onSuccess,
  onBack,
}: {
  onSuccess: () => void;
  onBack: () => void;
}) {
  const { login, isLoading, error, clearError } = useAuth();
  const [userId, setUserId] = React.useState('evaluator1');
  const [password, setPassword] = React.useState('eval1');

  const handleLogin = async () => {
    clearError();
    try {
      await login(userId, password);
      onSuccess();
    } catch {}
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Evaluator Login</Text>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.form}>
        <Text style={styles.label}>User ID</Text>
        <TextInput
          style={styles.input}
          value={userId}
          onChangeText={setUserId}
          placeholder="e.g. evaluator1"
          placeholderTextColor="#666"
          autoCapitalize="none"
          editable={!isLoading}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="e.g. eval1"
          placeholderTextColor="#666"
          secureTextEntry
          editable={!isLoading}
        />
        <Text style={styles.credentialsHint}>Use evaluator1 / eval1 or evaluator2 / eval2</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, styles.loginButton]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function ClientLoginScreen({
  onSuccess,
  onBack,
}: {
  onSuccess: () => void;
  onBack: () => void;
}) {
  const { login, isLoading, error, clearError } = useAuth();
  const [userId, setUserId] = React.useState('client1');
  const [password, setPassword] = React.useState('client1');

  const handleLogin = async () => {
    clearError();
    try {
      await login(userId, password);
      onSuccess();
    } catch {}
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Client Login</Text>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.form}>
        <Text style={styles.label}>User ID</Text>
        <TextInput
          style={styles.input}
          value={userId}
          onChangeText={setUserId}
          placeholder="e.g. client1"
          placeholderTextColor="#666"
          autoCapitalize="none"
          editable={!isLoading}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="e.g. client1"
          placeholderTextColor="#666"
          secureTextEntry
          editable={!isLoading}
        />
        <Text style={styles.credentialsHint}>Use client1 / client1 or client2 / client2</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, styles.loginButton]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0f0f14',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  buttonClient: {
    backgroundColor: '#059669',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  hint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 24,
  },
  backButtonText: {
    color: '#3b82f6',
    fontSize: 16,
  },
  form: {
    marginTop: 24,
  },
  label: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 4,
  },
  input: {
    color: '#fff',
    fontSize: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    marginBottom: 16,
  },
  credentialsHint: {
    color: '#666',
    fontSize: 12,
    marginBottom: 8,
  },
  error: {
    color: '#ef4444',
    marginBottom: 12,
  },
  loginButton: {
    marginTop: 16,
  },
});
