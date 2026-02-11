# React Native Sockets POC

A React Native Proof of Concept for **real-time image sync** between evaluators and clients, comparing three transports: **MQTT**, **WebRTC**, and **Socket.io**.

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

## Real-Time Image Sync POC

### Roles
- **Evaluator**: Log in → Select package (MQTT / WebRTC / Socket.io) → See **only clients using that same protocol** → Select a client → Control images (prev/next) → End session → View **real-time performance metrics** (latency, success/fail, samples).
- **Client**: Log in → Select same package as evaluator → Wait for session → View images in real time (no controls). When the session ends, client returns to waiting; **logout button respects safe area** on all screens.

### Protocol filtering
The evaluator’s client list shows **only online clients that use the same protocol** (Socket.io, WebRTC, or MQTT) as the one selected. The client list screen displays the active protocol (e.g. “Select Client (WebRTC only)”).

### Performance metrics
Latency and message counts on the evaluator’s performance panel are updated in **real time** for all three protocols:
- **Socket.io / MQTT**: The client sends a latency **ack** (sent/received timestamps) back to the evaluator; the evaluator records it and the panel updates (polled every second).
- **WebRTC**: The client sends an ack over the data channel; the evaluator records it the same way.

### Backend (required)
Start the Node server (Socket.io + mock auth, WebRTC signaling, and `/api/clients` filtered by protocol). MQTT uses public broker `broker.emqx.io`; no extra server for MQTT.

```bash
cd server && npm install && npm start
# Server runs at http://localhost:3001
```

### Running the app
Use the same machine or set `src/constants/config.ts` (or env) so the app can reach the server:
- **iOS Simulator**: `localhost:3001` is fine.
- **Android Emulator**: use `http://10.0.2.2:3001` (or your machine’s IP).
- **Physical device**: use your machine’s LAN IP (e.g. `http://192.168.1.x:3001`).

```bash
# Install app deps
yarn install

# iOS
cd ios && pod install && cd ..
yarn ios

# Android
yarn android
```

### Mock credentials
- **Evaluator**: `evaluator1` / `eval1` or `evaluator2` / `eval2`
- **Client**: `client1` / `client1` or `client2` / `client2`

### Comparing packages
1. Evaluator and client both select the **same** package (e.g. Socket.io).
2. Evaluator sees only clients on that protocol; select a client and start the session.
3. Navigate images on the evaluator; client sees them in real time.
4. End session and check the performance screen (latency, reconnections, success/fail counts). Metrics update in real time for all protocols.

**Detailed package comparison:** See [docs/PACKAGES_COMPARISON.md](docs/PACKAGES_COMPARISON.md) for how each transport (Socket.io, MQTT, WebRTC) works, latency/ack flow, what’s needed to use it, web feasibility, pros/cons, and configuration.

## 🔧 Configuration

For the Real-Time Image Sync POC, server and broker URLs are in `src/constants/config.ts`:

- **Socket.io / WebRTC signaling**: `SOCKET_IO_URL` (e.g. `http://localhost:3001`)
- **MQTT**: `MQTT_BROKER_URL` (e.g. `ws://broker.emqx.io:8083/mqtt`)
- **API (auth, client list)**: `API_BASE_URL` (e.g. `http://localhost:3001`)

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