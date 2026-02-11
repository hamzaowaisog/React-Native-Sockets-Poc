import {
  SOCKET_CONFIG,
  SOCKET_EVENTS,
  CONNECTION_STATUS,
} from '../constants/socket.constants';
import {
  ConnectionStatus,
  SocketConnectionOptions,
  SocketError,
  ISocketService,
} from '../types/socket.types';

/**
 * Socket Service
 * Manages WebSocket connections with automatic reconnection and error handling
 */
class SocketService implements ISocketService {
  private socket: WebSocket | null = null;
  private connectionStatus: ConnectionStatus = CONNECTION_STATUS.DISCONNECTED;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private options: SocketConnectionOptions = {};

  /**
   * Connect to WebSocket server
   */
  connect(options: SocketConnectionOptions = {}): void {
    try {
      // Merge with defaults
      this.options = {
        url: options.url || SOCKET_CONFIG.URL,
        timeout: options.timeout || SOCKET_CONFIG.TIMEOUT,
        autoReconnect: options.autoReconnect ?? true,
        reconnectInterval: options.reconnectInterval || SOCKET_CONFIG.RECONNECT_INTERVAL,
        maxReconnectAttempts: options.maxReconnectAttempts || SOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS,
      };

      // Prevent multiple connections
      if (this.socket && this.connectionStatus === CONNECTION_STATUS.CONNECTED) {
        console.warn('Socket already connected');
        return;
      }

      this.updateConnectionStatus(CONNECTION_STATUS.CONNECTING);

      // Create WebSocket connection
      this.socket = new WebSocket(this.options.url!);

      // Setup event handlers
      this.setupSocketHandlers();

      // Set connection timeout
      const timeoutId = setTimeout(() => {
        if (this.connectionStatus === CONNECTION_STATUS.CONNECTING) {
          this.handleError({
            message: 'Connection timeout',
            code: 'TIMEOUT',
            timestamp: Date.now(),
          });
          this.socket?.close();
        }
      }, this.options.timeout);

      // Clear timeout on successful connection
      this.socket.onopen = () => {
        clearTimeout(timeoutId);
        this.handleOpen();
      };
    } catch (error) {
      this.handleError({
        message: error instanceof Error ? error.message : 'Connection failed',
        code: 'CONNECTION_ERROR',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    try {
      // Clear reconnect timer
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // Close socket connection
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }

      this.updateConnectionStatus(CONNECTION_STATUS.DISCONNECTED);
      this.reconnectAttempts = 0;

      // Emit disconnect event
      this.emitToListeners(SOCKET_EVENTS.DISCONNECT, {
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  }

  /**
   * Emit event to server
   */
  emit(event: string, data?: any): void {
    try {
      if (!this.socket || this.connectionStatus !== CONNECTION_STATUS.CONNECTED) {
        console.warn('Socket not connected. Cannot emit event:', event);
        return;
      }

      const message = JSON.stringify({
        event,
        data,
        timestamp: Date.now(),
      });

      this.socket.send(message);
    } catch (error) {
      console.error('Error emitting event:', error);
      this.handleError({
        message: error instanceof Error ? error.message : 'Failed to emit event',
        code: 'EMIT_ERROR',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Register event listener
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback?: (data: any) => void): void {
    if (!callback) {
      // Remove all listeners for this event
      this.listeners.delete(event);
      return;
    }

    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.socket) return;

    this.socket.onmessage = (event) => this.handleMessage(event);
    this.socket.onerror = (error) => this.handleError({
      message: 'WebSocket error occurred',
      code: 'WEBSOCKET_ERROR',
      timestamp: Date.now(),
    });
    this.socket.onclose = () => this.handleClose();
  }

  /**
   * Handle socket open event
   */
  private handleOpen(): void {
    this.updateConnectionStatus(CONNECTION_STATUS.CONNECTED);
    this.reconnectAttempts = 0;

    // Emit connect event
    this.emitToListeners(SOCKET_EVENTS.CONNECT, {
      timestamp: Date.now(),
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      const { event: eventName, data } = message;

      // Emit to registered listeners
      this.emitToListeners(eventName, data);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  /**
   * Handle socket error
   */
  private handleError(error: SocketError): void {
    this.updateConnectionStatus(CONNECTION_STATUS.ERROR);

    // Emit error event
    this.emitToListeners(SOCKET_EVENTS.ERROR, error);

    console.error('Socket error:', error);
  }

  /**
   * Handle socket close event
   */
  private handleClose(): void {
    const wasConnected = this.connectionStatus === CONNECTION_STATUS.CONNECTED;

    this.updateConnectionStatus(CONNECTION_STATUS.DISCONNECTED);

    // Emit disconnect event
    if (wasConnected) {
      this.emitToListeners(SOCKET_EVENTS.DISCONNECT, {
        timestamp: Date.now(),
      });
    }

    // Attempt reconnection if enabled
    if (this.options.autoReconnect && this.reconnectAttempts < (this.options.maxReconnectAttempts || 0)) {
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    this.reconnectAttempts++;
    this.updateConnectionStatus(CONNECTION_STATUS.RECONNECTING);

    // Emit reconnect event
    this.emitToListeners(SOCKET_EVENTS.RECONNECT, {
      attempt: this.reconnectAttempts,
      maxAttempts: this.options.maxReconnectAttempts,
      timestamp: Date.now(),
    });

    this.reconnectTimer = setTimeout(() => {
      console.log(`Reconnection attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts}`);
      this.connect(this.options);
    }, this.options.reconnectInterval);
  }

  /**
   * Update connection status
   */
  private updateConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
  }

  /**
   * Emit event to all registered listeners
   */
  private emitToListeners(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in listener for event ${event}:`, error);
        }
      });
    }
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;
