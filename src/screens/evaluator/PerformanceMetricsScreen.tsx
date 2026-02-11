/**
 * Evaluator: performance report after session
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share } from 'react-native';
import { SafeScreenView } from '../../components/SafeScreenView';
import { useSession } from '../../context';
import { useRealtime } from '../../context';
import { PerformanceMetrics } from '../../components/PerformanceMetrics';
import { exportMetricsAsJson, exportMetricsAsCsv } from '../../utils/metricsExport';

export function PerformanceMetricsScreen({ onDone }: { onDone: () => void }) {
  const { metrics, getMetrics } = useSession();
  const { package: pkg } = useRealtime();
  const m = metrics ?? getMetrics();
  const packageName = pkg === 'socketio' ? 'Socket.io' : pkg === 'mqtt' ? 'MQTT' : 'WebRTC';

  const handleExport = async (format: 'json' | 'csv') => {
    const data = format === 'json' ? exportMetricsAsJson(m, packageName) : exportMetricsAsCsv(m, packageName);
    try {
      await Share.share({
        message: data,
        title: `Metrics (${packageName})`,
      });
    } catch {}
  };

  return (
    <SafeScreenView style={styles.container}>
      <Text style={styles.title}>Session Performance</Text>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <PerformanceMetrics metrics={m} />
      </ScrollView>
      <View style={styles.exportRow}>
        <TouchableOpacity style={styles.exportButton} onPress={() => handleExport('json')}>
          <Text style={styles.exportButtonText}>Export JSON</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportButton} onPress={() => handleExport('csv')}>
          <Text style={styles.exportButtonText}>Export CSV</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.button} onPress={onDone}>
        <Text style={styles.buttonText}>Back to Client List</Text>
      </TouchableOpacity>
    </SafeScreenView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f14',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  exportRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  exportButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#93c5fd',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
