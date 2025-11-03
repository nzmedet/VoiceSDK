# @nzmedet/voice-sdk API Documentation

## Installation

```bash
npm install @nzmedet/voice-sdk
```

## Setup

### Initialization

```typescript
import { VoiceSDK, VoiceSDKProvider } from '@nzmedet/voice-sdk';

// Initialize Firebase first via @react-native-firebase/app
// initializeApp();

// Initialize the SDK
await VoiceSDK.init({
  appName: 'MyApp',
  turnServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
      username: 'your-username',
      credential: 'your-credential',
    },
  ],
  callbacks: {
    // Optional client-side callbacks
    onTokenUpdate: async (platform, token) => {
      // Store token in your database
    },
    onCallStarted: async (callId, callerId, calleeId) => {
      // Client-side logic when call starts
    },
    onCallStateChanged: async (callId, state) => {
      // Client-side logic when call state changes
    },
    onCallEnded: async (callId, startTime, endTime) => {
      // Client-side logic when call ends
    },
  },
  customScreens: {
    // Optional custom screen components
    IncomingCallScreen: CustomIncomingScreen,
    ActiveCallScreen: CustomActiveScreen,
  },
});
```

### Wrap App with VoiceSDKProvider

**Required:** The SDK uses React Context to provide functionality to hooks. You must wrap your app with `VoiceSDKProvider`:

```typescript
import React from 'react';
import { VoiceSDK, VoiceSDKProvider } from '@nzmedet/voice-sdk';

function App() {
  const [initialized, setInitialized] = React.useState(false);

  React.useEffect(() => {
    VoiceSDK.init({
      appName: 'MyApp',
      turnServers: [/* ... */],
      callbacks: { /* ... */ },
    })
      .then(() => setInitialized(true))
      .catch((error) => console.error('Initialization failed:', error));
  }, []);

  if (!initialized) {
    return <LoadingScreen />;
  }

  return (
    <VoiceSDKProvider value={VoiceSDK.getContextValue()}>
      <YourAppContent />
    </VoiceSDKProvider>
  );
}
```

**Why Context?** The SDK uses React Context instead of global variables for better React patterns, type safety, and testability. The `useCall()` and `useIncomingCall()` hooks require this provider.

### Enable Debug Mode

```typescript
VoiceSDK.enableDebugMode();
```

### Token Management

Tokens are automatically registered and received by the SDK. When tokens are available, your `onTokenUpdate` callback is called, where you should store them in your database.

### Event Listeners

```typescript
VoiceSDK.on('call:ended', (event: CallEvent) => {
  const durationMinutes = (event.endTime - event.startTime) / 60000;
  console.log('Call ended:', event.callId, 'Duration:', durationMinutes, 'minutes');
});
```

## Hooks

### `useCall()`

Hook for managing outgoing calls.

```typescript
const {
  startCall,
  endCall,
  isConnected,
  callState,
  remoteStream,
  localStream,
  callId,
  error,
} = useCall();
```

#### Methods

- `startCall(calleeId: string): Promise<void>` - Start a new call
- `endCall(): Promise<void>` - End the current call

#### State

- `isConnected: boolean` - Whether the call is connected
- `callState: CallState` - Current call state ('idle' | 'ringing' | 'connecting' | 'active' | 'ended' | 'failed')
- `remoteStream?: MediaStream` - Remote audio stream
- `localStream?: MediaStream` - Local audio stream (internal use)
- `callId?: CallId` - Current call ID
- `error?: Error` - Any error that occurred

### `useIncomingCall()`

Hook for managing incoming calls. Must be used within a `VoiceSDKProvider`.

```typescript
const {
  incomingCall,
  answer,
  decline,
  isAnswering,
} = useIncomingCall();
```

#### Methods

- `answer(): Promise<void>` - Answer the incoming call
- `decline(): Promise<void>` - Decline the incoming call

#### State

- `incomingCall: IncomingCall | null` - Current incoming call information
- `isAnswering: boolean` - Whether the call is currently being answered
- `getCallMetadata: (callId: CallId) => CallMetadata | undefined` - Get stored call metadata by callId

### `CallMetadata`

```typescript
interface CallMetadata {
  callId: CallId;
  caller: CallParticipant;
  callee: CallParticipant;
  metadata?: Record<string, unknown>; // Additional metadata from push payload
  receivedAt: number; // Timestamp when call was received
}
```

## Types

### `CallState`

```typescript
type CallState = 'idle' | 'ringing' | 'connecting' | 'active' | 'ended' | 'failed';
```

### `CallEvent`

```typescript
interface CallEvent {
  callId: CallId;
  startTime: number; // Unix timestamp in milliseconds
  endTime: number; // Unix timestamp in milliseconds
  participants: [UserId, UserId];
}
```

### `CallParticipant`

```typescript
interface CallParticipant {
  id: string;
  displayName: string;
  photoURL?: string;
  // Backend can add additional fields here
  [key: string]: unknown;
}
```

### `IncomingCall`

```typescript
interface IncomingCall {
  callId: CallId;
  caller: CallParticipant;
  callee?: CallParticipant; // Current user receiving the call (optional - auto-populated if not provided)
  metadata?: Record<string, unknown>; // Additional metadata from push payload
}
```

## Context API

### `VoiceSDKProvider`

React Context Provider that supplies the SDK instance to hooks.

**Props:**
- `value: VoiceSDKContextValue` - The context value obtained from `VoiceSDK.getContextValue()`

**Usage:**
```typescript
<VoiceSDKProvider value={VoiceSDK.getContextValue()}>
  <YourApp />
</VoiceSDKProvider>
```

### `useVoiceSDKContext()`

Hook to access the VoiceSDK context directly (usually not needed - use `useCall()` and `useIncomingCall()` instead).

```typescript
const voiceSDK = useVoiceSDKContext();
// Access: voiceSDK.config, voiceSDK.instance, voiceSDK.setIncomingCallHandler, voiceSDK.getCallMetadata
```

## UI Components

### `IncomingCallScreen`

Pre-built screen component for displaying incoming calls. Must be used within a `VoiceSDKProvider`.

```typescript
import { IncomingCallScreen } from 'voice-sdk';

// No props needed - component gets all data from useIncomingCall hook
<IncomingCallScreen />
```

### `ActiveCallScreen`

Pre-built screen component for displaying active calls. Must be used within a `VoiceSDKProvider`.

```typescript
import { ActiveCallScreen } from 'voice-sdk';

<ActiveCallScreen />
```

## Example

### Complete Example App

```tsx
import React, { useState, useEffect } from 'react';
import { View, Button, Text } from 'react-native';
import { VoiceSDK, VoiceSDKProvider, useCall, useIncomingCall } from 'voice-sdk';

function AppContent() {
  const { startCall, endCall, callState, isConnected } = useCall();
  const { incomingCall, answer, decline } = useIncomingCall();

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text>Call State: {callState}</Text>
      <Text>Connected: {isConnected ? 'Yes' : 'No'}</Text>

      <Button title="Call Alice" onPress={() => startCall('alice123')} />
      <Button title="End Call" onPress={endCall} />

      {incomingCall && (
        <View>
          <Text>{incomingCall.caller.displayName} is calling...</Text>
          <Button title="Answer" onPress={answer} />
          <Button title="Decline" onPress={decline} />
        </View>
      )}
    </View>
  );
}

export default function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Initialize Firebase first via @react-native-firebase/app
    // initializeApp();

    VoiceSDK.init({
      appName: 'MyApp',
      turnServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
      .then(() => setInitialized(true))
      .catch((error) => console.error('Initialization failed:', error));
  }, []);

  if (!initialized) {
    return <View><Text>Initializing...</Text></View>;
  }

  return (
    <VoiceSDKProvider value={VoiceSDK.getContextValue()}>
      <AppContent />
    </VoiceSDKProvider>
  );
}
```

## Firebase Configuration

### Firestore Security Rules

The package includes Firestore security rules that should be deployed:

```bash
firebase deploy --only firestore:rules
```

### Cloud Functions

**Important:** You must implement your own Cloud Functions. The SDK provides reusable helper functions that you can import.

**Required Functions (You Implement):**
- **Call Initiation**: Create call records, send push notifications
- **Call Termination**: Process ended calls, calculate duration
- **Billing**: Calculate costs, update balances, process payments
- **Cleanup** (optional): Handle stale/abandoned calls

**Helper Functions Available:**
- `handleCallEnded()` - Processes call termination, calculates duration
- `calculateCallCost()` - Calculates billing based on duration
- `handleCallStarted()` - Creates call records
- `updateCallState()` - Updates call state

See `firebase/functions/README.md` for detailed documentation and usage examples.

