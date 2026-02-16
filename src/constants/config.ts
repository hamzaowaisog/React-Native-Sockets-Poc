/**
 * App configuration - use env or defaults for POC
 *
 * Two simulators on one machine: set HOST_IP to your Mac's IP (e.g. from `ifconfig | grep "inet "`)
 * so both simulators can reach the server. Then API_BASE_URL and SOCKET_IO_URL use it.
 */

const getEnv = (key: string, fallback: string): string => {
  // React Native doesn't have process.env in the same way; use __DEV__ or a config module
  if (typeof global !== 'undefined' && (global as any).__CONFIG__?.[key]) {
    return (global as any).__CONFIG__[key];
  }
  return fallback;
};

/** For two simulators on one machine: set to your Mac's IP (e.g. '192.168.1.5'). Leave 'localhost' for single device. */
const HOST_IP = getEnv('HOST_IP', '10.220.16.139');
const BASE = `http://${HOST_IP}:3001`;

export const CONFIG = {
  HOST_IP,
  API_BASE_URL: getEnv('API_BASE_URL', BASE),
  SOCKET_IO_URL: getEnv('SOCKET_IO_URL', BASE),
  MQTT_BROKER_URL: getEnv('MQTT_BROKER_URL', 'ws://broker.emqx.io:8083/mqtt'),
  MQTT_TOPIC_PREFIX: 'realtime-sync',
} as const;
