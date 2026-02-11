/**
 * Evaluator: choose MQTT / WebRTC / Socket.io before client list
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRealtime } from '../../context';
import type { RealtimePackage } from '../../types/realtime.types';

const PACKAGES: { id: RealtimePackage; label: string }[] = [
  { id: 'socketio', label: 'Socket.io' },
  { id: 'mqtt', label: 'MQTT' },
  { id: 'webrtc', label: 'WebRTC' },
];

export function PackageSelectorScreen({
  onContinue,
  onBack,
}: {
  onContinue: () => void;
  onBack: () => void;
}) {
  const { package: currentPackage, setPackage } = useRealtime();

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Text style={styles.backText}>← Logout</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Select real-time package</Text>
      <Text style={styles.subtitle}>Compare latency and stability</Text>
      {PACKAGES.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={[styles.option, currentPackage === p.id && styles.optionSelected]}
          onPress={() => setPackage(p.id)}
        >
          <Text style={styles.optionText}>{p.label}</Text>
          {currentPackage === p.id ? <Text style={styles.check}>✓</Text> : null}
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
        <Text style={styles.continueText}>Continue to client list</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#0f0f14',
  },
  backButton: {
    marginBottom: 24,
  },
  backText: {
    color: '#3b82f6',
    fontSize: 16,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 24,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: '#3b82f6',
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
  },
  check: {
    color: '#3b82f6',
    fontSize: 18,
  },
  continueButton: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    alignItems: 'center',
  },
  continueText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
