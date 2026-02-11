# Quick Reference Guide

## File Structure Overview

### Core Files

1. **src/constants/socket.constants.ts**
   - Socket configuration (URL, timeout, reconnect settings)
   - Event name constants
   - Connection status constants

2. **src/types/socket.types.ts**
   - TypeScript interfaces and types
   - Connection status types
   - Message and error interfaces
   - Hook and service interfaces

3. **src/services/socket.service.ts**
   - WebSocket connection management
   - Event emitting and listening
   - Automatic reconnection logic
   - Error handling

4. **src/hooks/useSocket.ts**
   - React hook wrapper for socket service
   - Connection state management
   - Lifecycle management and cleanup

5. **src/components/SocketExample.tsx**
   - Example chat component
   - Demonstrates all features
   - UI with connection status

6. **src/utils/socket.utils.ts**
   - Helper utilities
   - Validation functions
   - Retry and throttle utilities

## Key Features

### 1. Connection Management
```typescript
const { connect, disconnect, isConnected } = useSocket();

// Connect with custom options
connect({ 
  url: 'ws://localhost:3000',
  autoReconnect: true 
});

// Disconnect
disconnect();
```

### 2. Event Handling
```typescript
// Listen for events
useEffect(() => {
  const handler = (data) => console.log(data);
  on(SOCKET_EVENTS.MESSAGE, handler);
  
  return () => off(SOCKET_EVENTS.MESSAGE, handler);
}, [on, off]);

// Emit events
emit(SOCKET_EVENTS.MESSAGE, { text: 'Hello' });
```

### 3. Connection States
- `DISCONNECTED` - Not connected
- `CONNECTING` - Connection in progress
- `CONNECTED` - Active connection
- `ERROR` - Connection error occurred
- `RECONNECTING` - Attempting to reconnect

### 4. Error Handling
```typescript
const { error, isError } = useSocket();

if (isError) {
  console.error('Socket error:', error?.message);
}
```

## Customization

### Add New Events
Edit `src/constants/socket.constants.ts`:
```typescript
export const SOCKET_EVENTS = {
  // ... existing events
  MY_CUSTOM_EVENT: 'my_custom_event',
};
```

### Configure Connection
Edit `src/constants/socket.constants.ts`:
```typescript
export const SOCKET_CONFIG = {
  URL: 'wss://your-production-server.com',
  TIMEOUT: 10000,
  RECONNECT_INTERVAL: 5000,
  MAX_RECONNECT_ATTEMPTS: 10,
};
```

### Create Custom Components
```typescript
import React from 'react';
import { useSocket } from './src/hooks';
import { SOCKET_EVENTS } from './src/constants';

const MyCustomComponent = () => {
  const { isConnected, emit, on } = useSocket(true);
  
  // Your component logic
  
  return (/* Your UI */);
};
```

## Architecture Benefits

1. **Separation of Concerns**
   - Service layer handles connection logic
   - Hook manages React state
   - Components focus on UI

2. **Type Safety**
   - Full TypeScript support
   - Interface-driven development
   - Compile-time error checking

3. **Error Resilience**
   - Automatic reconnection
   - Timeout handling
   - Error propagation

4. **Clean Code**
   - Single responsibility principle
   - Easy to test
   - Easy to extend

## Next Steps

1. Replace placeholder URL with your WebSocket server
2. Add your custom events
3. Create components for your use case
4. Add authentication if needed
5. Implement additional features as required

## Common Patterns

### Pattern 1: Auto-Connect Component
```typescript
const ChatScreen = () => {
  const socket = useSocket(true, { url: 'ws://localhost:3000' });
  // Component auto-connects on mount
};
```

### Pattern 2: Manual Connection
```typescript
const SettingsScreen = () => {
  const { connect, disconnect } = useSocket(false);
  
  return (
    <Button onPress={() => connect()}>Connect</Button>
  );
};
```

### Pattern 3: Direct Service Usage
```typescript
import { socketService } from './src/services';

// Use outside React components
socketService.connect();
socketService.emit('event', data);
```

## Troubleshooting

### Connection Issues
- Verify WebSocket URL is correct
- Check server is running
- Ensure network connectivity
- Check timeout settings

### Message Not Received
- Verify event name matches server
- Check listener is registered before event fires
- Ensure connection is established

### Memory Leaks
- Always cleanup listeners in useEffect
- Unregister callbacks on unmount
- Use the off() method properly
