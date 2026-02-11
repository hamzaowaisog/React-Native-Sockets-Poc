import { useState, useEffect, useCallback, useRef } from 'react';
import { socketService } from '../services/socket.service';
import { CONNECTION_STATUS, SOCKET_EVENTS } from '../constants/socket.constants';
import {
  UseSocketReturn,
  SocketConnectionOptions,
  SocketError,
  ConnectionStatus,
} from '../types/socket.types';

/**
 * Custom hook for managing WebSocket connections
 * Provides connection state management and socket operations
 */
export const useSocket = (autoConnect: boolean = false, options?: SocketConnectionOptions): UseSocketReturn => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    CONNECTION_STATUS.DISCONNECTED
  );
  const [error, setError] = useState<SocketError | null>(null);
  const isMountedRef = useRef(true);

  // Derived states
  const isConnected = connectionStatus === CONNECTION_STATUS.CONNECTED;
  const isConnecting = connectionStatus === CONNECTION_STATUS.CONNECTING || 
                       connectionStatus === CONNECTION_STATUS.RECONNECTING;
  const isError = connectionStatus === CONNECTION_STATUS.ERROR;

  /**
   * Handle connection status changes
   */
  const handleStatusChange = useCallback(() => {
    if (!isMountedRef.current) return;
    
    const status = socketService.getConnectionStatus();
    setConnectionStatus(status);
    
    // Clear error when connected
    if (status === CONNECTION_STATUS.CONNECTED) {
      setError(null);
    }
  }, []);

  /**
   * Handle socket errors
   */
  const handleError = useCallback((errorData: SocketError) => {
    if (!isMountedRef.current) return;
    
    setError(errorData);
    setConnectionStatus(CONNECTION_STATUS.ERROR);
  }, []);

  /**
   * Connect to socket server
   */
  const connect = useCallback((connectOptions?: SocketConnectionOptions) => {
    try {
      const mergedOptions = { ...options, ...connectOptions };
      socketService.connect(mergedOptions);
      handleStatusChange();
    } catch (err) {
      handleError({
        message: err instanceof Error ? err.message : 'Failed to connect',
        code: 'CONNECT_ERROR',
        timestamp: Date.now(),
      });
    }
  }, [options, handleStatusChange, handleError]);

  /**
   * Disconnect from socket server
   */
  const disconnect = useCallback(() => {
    try {
      socketService.disconnect();
      handleStatusChange();
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  }, [handleStatusChange]);

  /**
   * Emit event to server
   */
  const emit = useCallback((event: string, data?: any) => {
    try {
      socketService.emit(event, data);
    } catch (err) {
      console.error('Error emitting event:', err);
    }
  }, []);

  /**
   * Register event listener
   */
  const on = useCallback((event: string, callback: (data: any) => void) => {
    socketService.on(event, callback);
  }, []);

  /**
   * Remove event listener
   */
  const off = useCallback((event: string, callback?: (data: any) => void) => {
    socketService.off(event, callback);
  }, []);

  /**
   * Setup socket event listeners
   */
  useEffect(() => {
    // Listen for connection events
    socketService.on(SOCKET_EVENTS.CONNECT, handleStatusChange);
    socketService.on(SOCKET_EVENTS.DISCONNECT, handleStatusChange);
    socketService.on(SOCKET_EVENTS.RECONNECT, handleStatusChange);
    socketService.on(SOCKET_EVENTS.ERROR, handleError);

    return () => {
      // Cleanup listeners
      socketService.off(SOCKET_EVENTS.CONNECT, handleStatusChange);
      socketService.off(SOCKET_EVENTS.DISCONNECT, handleStatusChange);
      socketService.off(SOCKET_EVENTS.RECONNECT, handleStatusChange);
      socketService.off(SOCKET_EVENTS.ERROR, handleError);
    };
  }, [handleStatusChange, handleError]);

  /**
   * Auto-connect on mount if enabled
   */
  useEffect(() => {
    if (autoConnect) {
      connect(options);
    }

    return () => {
      isMountedRef.current = false;
      // Optionally disconnect on unmount
      // disconnect();
    };
  }, [autoConnect]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // State
    isConnected,
    isConnecting,
    isError,
    connectionStatus,
    error,
    
    // Methods
    connect,
    disconnect,
    emit,
    on,
    off,
  };
};

export default useSocket;
