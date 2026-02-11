/**
 * Client: waiting for evaluator to start a session
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeScreenView } from '../../components/SafeScreenView';

export function WaitingScreen({ onLogout }: { onLogout?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <SafeScreenView style={styles.container}>
      {onLogout ? (
        <TouchableOpacity
          style={[styles.logoutButton, { top: insets.top + 16 }]}
          onPress={onLogout}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      ) : null}
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.title}>Waiting for session</Text>
      <Text style={styles.subtitle}>
        An evaluator will start a session to share images with you.
      </Text>
    </SafeScreenView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f14',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  logoutButton: {
    position: 'absolute',
    right: 24,
    paddingVertical: 8,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  logoutText: {
    color: '#3b82f6',
    fontSize: 16,
  },
});
