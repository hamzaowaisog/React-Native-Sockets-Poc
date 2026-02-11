/**
 * Client: waiting for evaluator to start a session
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

export function WaitingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.title}>Waiting for session</Text>
      <Text style={styles.subtitle}>
        An evaluator will start a session to share images with you.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f14',
    padding: 24,
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
});
