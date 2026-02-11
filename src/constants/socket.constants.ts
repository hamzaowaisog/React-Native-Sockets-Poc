/**
 * Socket connection constants
 */
export const SOCKET_CONFIG = {
  // Replace with your actual WebSocket server URL
  URL: 'ws://localhost:3000',
  
  // Connection timeout in milliseconds
  TIMEOUT: 5000,
  
  // Reconnection settings
  RECONNECT_INTERVAL: 3000,
  MAX_RECONNECT_ATTEMPTS: 5,
};

/**
 * Socket event names
 */
export const SOCKET_EVENTS = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  RECONNECT: 'reconnect',
  
  // Custom application events (add your own here)
  MESSAGE: 'message',
  CHAT_MESSAGE: 'chat_message',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  TYPING: 'typing',
  TYPING_STOP: 'typing_stop',
} as const;

/**
 * Socket connection states
 */
export const CONNECTION_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error',
  RECONNECTING: 'reconnecting',
} as const;
