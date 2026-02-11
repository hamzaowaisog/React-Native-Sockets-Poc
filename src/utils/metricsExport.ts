/**
 * Export latency metrics to JSON or CSV format
 */

import type { LatencyMetrics } from '../types/realtime.types';

export function exportMetricsAsJson(metrics: LatencyMetrics, packageName: string): string {
  return JSON.stringify(
    {
      package: packageName,
      exportedAt: new Date().toISOString(),
      ...metrics,
    },
    null,
    2
  );
}

export function exportMetricsAsCsv(metrics: LatencyMetrics, packageName: string): string {
  const headers = [
    'package',
    'exportedAt',
    'lastLatencyMs',
    'avgLatencyMs',
    'minLatencyMs',
    'maxLatencyMs',
    'sampleCount',
    'reconnectionAttempts',
    'failedMessages',
    'successfulMessages',
  ];
  const row = [
    packageName,
    new Date().toISOString(),
    metrics.lastLatencyMs,
    metrics.avgLatencyMs,
    metrics.minLatencyMs,
    metrics.maxLatencyMs,
    metrics.sampleCount,
    metrics.reconnectionAttempts,
    metrics.failedMessages,
    metrics.successfulMessages,
  ].join(',');
  return [headers.join(','), row].join('\n');
}
