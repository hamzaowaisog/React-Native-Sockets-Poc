# React Native WebSocket POC

A well-structured React Native WebSocket Proof of Concept with TypeScript, featuring a modular architecture for real-time communication.

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── SocketExample.tsx   # Example component demonstrating socket usage
│   └── index.ts            # Component exports
├── hooks/              # Custom React hooks
│   ├── useSocket.ts        # Socket connection hook with state management
│   └── index.ts            # Hook exports
├── services/           # Business logic and services
│   ├── socket.service.ts   # WebSocket service with reconnection logic
│   └── index.ts            # Service exports
├── constants/          # Application constants
│   ├── socket.constants.ts # Socket events, URLs, and configuration
│   └── index.ts            # Constant exports
├── types/              # TypeScript type definitions
│   ├── socket.types.ts     # Socket-related interfaces and types
│   └── index.ts            # Type exports
├── utils/              # Utility functions
│   ├── socket.utils.ts     # Helper functions for socket operations
│   └── index.ts            # Utility exports
└── index.ts            # Main entry point
```

## 🚀 Features

### Socket Service (`socket.service.ts`)
- ✅ WebSocket connection management
- ✅ Automatic reconnection with exponential backoff
- ✅ Connection timeout handling
- ✅ Event-based message handling
- ✅ Error handling and recovery
- ✅ Support for custom connection options

### Custom Hook (`useSocket.ts`)
- ✅ React hook for socket state management
- ✅ Connection status tracking (connected, connecting, error, etc.)
- ✅ Auto-connect capability
- ✅ Proper cleanup on unmount
- ✅ Easy-to-use API for emit/on/off operations

### Example Component (`SocketExample.tsx`)
- ✅ Real-time chat interface
- ✅ Connection status indicator
- ✅ Message sending and receiving
- ✅ User join notifications
- ✅ Clean, Material Design-inspired UI

## 📦 Installation

```bash
# Install dependencies
npm install

# For iOS
cd ios && pod install && cd ..

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## 🔧 Configuration

Update the WebSocket URL in `src/constants/socket.constants.ts`:

```typescript
export const SOCKET_CONFIG = {
  URL: 'ws://your-server-url:port',
  TIMEOUT: 5000,
  RECONNECT_INTERVAL: 3000,
  MAX_RECONNECT_ATTEMPTS: 5,
};
```

## 💻 Usage

### Basic Usage with Hook

```typescript
import React, { useEffect } from 'react';
import { View, Button, Text } from 'react-native';
import { useSocket } from './src/hooks';
import { SOCKET_EVENTS } from './src/constants';

const MyComponent = () => {
  const { 
    isConnected, 
    connect, 
    disconnect, 
    emit, 
    on, 
    off 
  } = useSocket();

  useEffect(() => {
    // Listen for messages
    const handleMessage = (data) => {
      console.log('Received:', data);
    };
    
    on(SOCKET_EVENTS.MESSAGE, handleMessage);
    
    return () => {
      off(SOCKET_EVENTS.MESSAGE, handleMessage);
    };
  }, [on, off]);

  const sendMessage = () => {
    emit(SOCKET_EVENTS.MESSAGE, { text: 'Hello!' });
  };

  return (
    <View>
      <Text>Status: {isConnected ? 'Connected' : 'Disconnected'}</Text>
      <Button 
        title={isConnected ? 'Disconnect' : 'Connect'} 
        onPress={isConnected ? disconnect : connect} 
      />
      <Button 
        title="Send Message" 
        onPress={sendMessage}
        disabled={!isConnected}
      />
    </View>
  );
};
```

### Direct Service Usage

```typescript
import { socketService } from './src/services';
import { SOCKET_EVENTS } from './src/constants';

// Connect
socketService.connect({
  url: 'ws://localhost:3000',
  autoReconnect: true,
});

// Listen for events
socketService.on(SOCKET_EVENTS.MESSAGE, (data) => {
  console.log('Message received:', data);
});

// Emit events
socketService.emit(SOCKET_EVENTS.MESSAGE, { 
  text: 'Hello, World!' 
});

// Disconnect
socketService.disconnect();
```

### Auto-Connect on Mount

```typescript
const { isConnected, emit } = useSocket(true, {
  url: 'ws://localhost:3000',
  autoReconnect: true,
  maxReconnectAttempts: 5,
});
```

## 🎯 Socket Events

Default events are defined in `src/constants/socket.constants.ts`:

```typescript
SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  RECONNECT: 'reconnect',
  MESSAGE: 'message',
  CHAT_MESSAGE: 'chat_message',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  TYPING: 'typing',
  TYPING_STOP: 'typing_stop',
}
```

Add your custom events to this object as needed.

## 🛠️ TypeScript Support

All components, hooks, and services are fully typed with TypeScript interfaces:

- `ConnectionStatus` - Connection state types
- `SocketMessage` - Message structure
- `SocketError` - Error information
- `SocketConnectionOptions` - Connection configuration
- `UseSocketReturn` - Hook return type

## 🧪 Error Handling

The service includes comprehensive error handling:
- Connection timeouts
- WebSocket errors
- Reconnection failures
- Message parsing errors

All errors are propagated through the `error` state in the hook.

## 🔄 Reconnection

Automatic reconnection is enabled by default with:
- Exponential backoff
- Configurable max attempts
- Configurable retry interval
- Status updates during reconnection

## 📝 Best Practices

1. **Cleanup**: Always unregister event listeners in `useEffect` cleanup
2. **Error Handling**: Check connection status before emitting events
3. **Type Safety**: Use provided TypeScript interfaces
4. **Custom Events**: Add new events to constants file
5. **Configuration**: Use environment variables for URLs in production

## 🤝 Contributing

This is a POC template. Feel free to extend and customize based on your needs.

## 📄 License

MIT