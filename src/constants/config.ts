/**
 * App configuration - use env or defaults for POC
 */

const getEnv = (key: string, fallback: string): string => {
  // React Native doesn't have process.env in the same way; use __DEV__ or a config module
  if (typeof global !== 'undefined' && (global as any).__CONFIG__?.[key]) {
    return (global as any).__CONFIG__[key];
  }
  return fallback;
};

export const CONFIG = {
  API_BASE_URL: getEnv('API_BASE_URL', 'http://localhost:3001'),
  SOCKET_IO_URL: getEnv('SOCKET_IO_URL', 'http://localhost:3001'),
  MQTT_BROKER_URL: getEnv('MQTT_BROKER_URL', 'ws://broker.emqx.io:8083/mqtt'),
  MQTT_TOPIC_PREFIX: 'realtime-sync',
} as const;
