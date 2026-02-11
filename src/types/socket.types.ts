import { CONNECTION_STATUS, SOCKET_EVENTS } from '../constants/socket.constants';

/**
 * Type for connection status values
 */
export type ConnectionStatus = typeof CONNECTION_STATUS[keyof typeof CONNECTION_STATUS];

/**
 * Type for socket event names
 */
export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];

/**
 * Socket message interface
 */
export interface SocketMessage {
  event: string;
  data: any;
  timestamp?: number;
}

/**
 * Socket error interface
 */
export interface SocketError {
  message: string;
  code?: string | number;
  timestamp: number;
}

/**
 * Socket connection options
 */
export interface SocketConnectionOptions {
  url?: string;
  timeout?: number;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

/**
 * Socket service interface
 */
export interface ISocketService {
  connect(options?: SocketConnectionOptions): void;
  disconnect(): void;
  emit(event: string, data?: any): void;
  on(event: string, callback: (data: any) => void): void;
  off(event: string, callback?: (data: any) => void): void;
  getConnectionStatus(): ConnectionStatus;
}

/**
 * Socket hook state interface
 */
export interface SocketHookState {
  isConnected: boolean;
  isConnecting: boolean;
  isError: boolean;
  connectionStatus: ConnectionStatus;
  error: SocketError | null;
}

/**
 * Socket hook return interface
 */
export interface UseSocketReturn extends SocketHookState {
  connect: (options?: SocketConnectionOptions) => void;
  disconnect: () => void;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback?: (data: any) => void) => void;
}
