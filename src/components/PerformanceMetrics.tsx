/**
 * Latency and connection metrics display
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { LatencyMetrics } from '../types/realtime.types';

interface PerformanceMetricsProps {
  metrics: LatencyMetrics;
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function PerformanceMetrics({ metrics }: PerformanceMetricsProps) {
  const avg =
    metrics.sampleCount > 0
      ? Math.round(metrics.avgLatencyMs)
      : 0;
  const min =
    metrics.minLatencyMs !== Infinity
      ? Math.round(metrics.minLatencyMs)
      : 0;
  const max = Math.round(metrics.maxLatencyMs);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Performance</Text>
      <Row label="Last latency" value={`${metrics.lastLatencyMs} ms`} />
      <Row label="Avg latency" value={`${avg} ms`} />
      <Row label="Min / Max" value={`${min} / ${max} ms`} />
      <Row label="Samples" value={metrics.sampleCount} />
      <Row label="Reconnections" value={metrics.reconnectionAttempts} />
      <Row label="Success / Failed" value={`${metrics.successfulMessages} / ${metrics.failedMessages}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    margin: 16,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  label: {
    color: '#888',
    fontSize: 14,
  },
  value: {
    color: '#fff',
    fontSize: 14,
  },
});
