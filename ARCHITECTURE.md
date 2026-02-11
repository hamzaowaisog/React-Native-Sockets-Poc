# Architecture Documentation

## Overview

This React Native WebSocket POC follows a layered architecture pattern with clear separation of concerns.

## Architecture Layers

```
┌─────────────────────────────────────┐
│      Presentation Layer             │
│  (React Components / UI)            │
│  - SocketExample.tsx                │
│  - App.tsx                          │
└─────────────┬───────────────────────┘
              │ uses
              ▼
┌─────────────────────────────────────┐
│      Hook Layer                     │
│  (React State Management)           │
│  - useSocket.ts                     │
│    • Connection state               │
│    • React lifecycle integration    │
│    • Error state management         │
└─────────────┬───────────────────────┘
              │ uses
              ▼
┌─────────────────────────────────────┐
│      Service Layer                  │
│  (Business Logic)                   │
│  - socket.service.ts                │
│    • WebSocket management           │
│    • Event handling                 │
│    • Reconnection logic             │
│    • Error handling                 │
└─────────────┬───────────────────────┘
              │ uses
              ▼
┌─────────────────────────────────────┐
│      Foundation Layer               │
│  (Constants, Types, Utils)          │
│  - socket.constants.ts              │
│  - socket.types.ts                  │
│  - socket.utils.ts                  │
└─────────────────────────────────────┘
```

## Component Responsibilities

### 1. Presentation Layer (Components)

**Purpose**: Handle UI rendering and user interactions

**Files**:
- `src/components/SocketExample.tsx` - Example chat component
- `App.tsx` - Application entry point

**Responsibilities**:
- Render UI elements
- Handle user input
- Display connection status
- Show messages and errors
- Call hook methods for socket operations

**Does NOT**:
- Manage WebSocket connection directly
- Handle reconnection logic
- Parse socket messages

### 2. Hook Layer (React Hooks)

**Purpose**: Bridge between React components and socket service

**Files**:
- `src/hooks/useSocket.ts` - Custom hook for socket operations

**Responsibilities**:
- Manage React state (connection status, errors)
- Provide clean API to components
- Handle component lifecycle (mount/unmount)
- Subscribe to service events
- Clean up listeners on unmount

**Does NOT**:
- Implement WebSocket protocol
- Handle reconnection logic
- Manage actual socket connection

### 3. Service Layer (Business Logic)

**Purpose**: Implement core WebSocket functionality

**Files**:
- `src/services/socket.service.ts` - Singleton socket service

**Responsibilities**:
- Create and manage WebSocket connection
- Implement connect/disconnect/emit methods
- Handle automatic reconnection
- Manage event listeners
- Parse incoming messages
- Handle connection timeouts
- Error handling and recovery

**Does NOT**:
- Know about React or component state
- Render UI
- Handle user input

### 4. Foundation Layer (Support)

**Purpose**: Provide shared types, constants, and utilities

**Files**:
- `src/constants/socket.constants.ts` - Configuration and event names
- `src/types/socket.types.ts` - TypeScript interfaces
- `src/utils/socket.utils.ts` - Helper functions

**Responsibilities**:
- Define TypeScript interfaces
- Provide configuration constants
- Export event name constants
- Offer utility functions

## Data Flow

### Connecting to Socket

```
User clicks Connect
       ↓
Component calls connect()
       ↓
Hook's connect() method
       ↓
Service's connect() method
       ↓
WebSocket connection established
       ↓
Service emits 'connect' event
       ↓
Hook listens and updates state
       ↓
Component re-renders with new state
```

### Receiving Messages

```
Server sends message
       ↓
WebSocket onmessage handler
       ↓
Service parses message
       ↓
Service emits to registered listeners
       ↓
Component's listener receives data
       ↓
Component updates local state
       ↓
UI re-renders with new data
```

### Sending Messages

```
User types and clicks Send
       ↓
Component calls emit()
       ↓
Hook's emit() method
       ↓
Service's emit() method
       ↓
Validates connection status
       ↓
Serializes message to JSON
       ↓
Sends via WebSocket
```

## Error Handling Flow

```
Error occurs (timeout, connection lost, etc.)
       ↓
Service catches error
       ↓
Service updates connection status to ERROR
       ↓
Service emits 'error' event with details
       ↓
Hook listens and updates error state
       ↓
Component displays error to user
       ↓
[If auto-reconnect enabled]
       ↓
Service attempts reconnection
```

## Reconnection Flow

```
Connection lost
       ↓
Service detects disconnection
       ↓
Check if autoReconnect is enabled
       ↓
Check reconnect attempts < max
       ↓
Service sets status to RECONNECTING
       ↓
Service emits 'reconnect' event
       ↓
Hook updates status
       ↓
Component shows "Reconnecting..." UI
       ↓
Wait for reconnect interval
       ↓
Attempt connection again
       ↓
[Success] → Set status to CONNECTED
[Failure] → Retry or give up
```

## Singleton Pattern

The socket service is implemented as a singleton to ensure:
- Single WebSocket connection per application
- Shared state across all components
- No duplicate connections
- Consistent event handling

```typescript
// Service is exported as singleton instance
export const socketService = new SocketService();
```

## Type Safety

All interactions are strongly typed:

```typescript
// Connection options are typed
interface SocketConnectionOptions {
  url?: string;
  timeout?: number;
  autoReconnect?: boolean;
  // ...
}

// Hook return type is defined
interface UseSocketReturn {
  isConnected: boolean;
  connect: (options?: SocketConnectionOptions) => void;
  // ...
}

// Events use type constants
type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
```

## Benefits of This Architecture

1. **Separation of Concerns**
   - Each layer has a specific responsibility
   - Easy to understand and maintain

2. **Testability**
   - Service can be tested independently
   - Hooks can be tested with React Testing Library
   - Components can be tested in isolation

3. **Reusability**
   - Service can be used outside React
   - Hook can be used in any component
   - Components can be composed

4. **Scalability**
   - Easy to add new features
   - Easy to add new event types
   - Easy to extend functionality

5. **Type Safety**
   - Compile-time error checking
   - IntelliSense support
   - Reduced runtime errors

## Extension Points

### Adding New Features

1. **New Event Type**
   - Add to `SOCKET_EVENTS` in constants
   - No other changes needed

2. **New Connection Option**
   - Add to `SocketConnectionOptions` interface
   - Implement in service's connect method

3. **New Component**
   - Import and use `useSocket` hook
   - Subscribe to events as needed

4. **New Utility**
   - Add to `socket.utils.ts`
   - Export for use anywhere

## Best Practices Applied

1. **Single Responsibility Principle**
   - Each file has one clear purpose

2. **Dependency Inversion**
   - Layers depend on abstractions (interfaces)

3. **Open/Closed Principle**
   - Open for extension (new events, components)
   - Closed for modification (core logic stable)

4. **DRY (Don't Repeat Yourself)**
   - Constants defined once
   - Utilities shared across project

5. **Clean Code**
   - Descriptive names
   - Clear comments
   - Consistent formatting
